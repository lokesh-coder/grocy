import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, BackHandler, Linking, ScrollView, Share, StatusBar, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
	BasketIcon,
	ClockIcon,
	FilePlusIcon,
	GearIcon,
	MagicWandIcon,
	SealCheckIcon,
	ShareNetworkIcon,
	ShoppingBagIcon,
	TrashSimpleIcon,
	WarningCircleIcon,
	WhatsappLogoIcon,
	type Icon,
} from "phosphor-react-native";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { MicButton } from "../components/MicButton";
import { LoaderDots } from "../components/LoaderDots";
import { PopIn } from "../components/PopIn";
import { PressableScale } from "../components/PressableScale";
import { ConfettiBurst } from "../components/ConfettiBurst";
import { AccentButton } from "../components/AccentButton";
import { SettingsScreen } from "./SettingsScreen";
import {
	applyOperations,
	categorizeItems,
	estimatePrices,
	extractItems,
	OpenRouterLimitExceededError,
	OpenRouterNotConnectedError,
	parseSegmentOps,
	reconcileWithLive,
} from "../lib/extract";
import { getFrequentItems, getLastList, saveFinalizedList, updateLastList } from "../lib/listHistory";
import { getSelectedModel, setSelectedModel } from "../lib/modelSettings";
import { DEFAULT_MODEL_ID } from "../lib/models";
import { connectOpenRouter, disconnectOpenRouter, getOpenRouterKey, isAutoProvisionedKey } from "../lib/openrouterAuth";
import { CATEGORIES } from "../shared/categories";
import { categoryColor } from "../lib/categoryColors";
import { categoryIcon } from "../lib/categoryIcons";
import { colors, fontFamily, radius } from "../theme/tokens";
import type { ConfirmationReason, DraftItem, ListItem } from "../shared/types";

const REASON_LABELS: Record<ConfirmationReason, string> = {
	vague_quantity: "தெளிவற்ற அளவு",
	inferred_unit: "யூகிக்கப்பட்ட அலகு",
	default_quantity: "இயல்பு அளவு",
	uncertain_item_name: "உறுதியில்லாத பெயர்",
	uncertain_brand: "உறுதியில்லாத பிராண்ட்",
	ambiguous_merge: "தெளிவற்ற இணைப்பு",
};

type FrequentItem = { name: string; quantity: string };

// Uniform treatment for all three - no WhatsApp size/color emphasis, no
// per-icon color tinting. Reading as one cohesive row of equal-weight
// actions is the point (see the design-system discussion in this commit).
// Fun comes from each icon's own duotone color pair, not from varying the
// button shape/size/background - that keeps the row visually consistent
// while still giving each action its own identity.
type ShareAction = "new" | "whatsapp" | "share";
const SHARE_ACTIONS: Array<{ action: ShareAction; Icon: Icon; label: string; color: string }> = [
	{ action: "new", Icon: FilePlusIcon, label: "புதிய பட்டியல்", color: colors.fun.sage },
	{ action: "whatsapp", Icon: WhatsappLogoIcon, label: "WhatsApp", color: colors.fun.blue },
	{ action: "share", Icon: ShareNetworkIcon, label: "பகிரவும்", color: colors.fun.berry },
];

// There's no shared/live list anymore (see the backend simplification) - a
// finished list is shared as plain formatted text over the OS share sheet,
// not a link. Includes prices/total only once "Organize" has actually run.
function buildShareText(items: DraftItem[], organizedItems: ListItem[] | null): string {
	const lineFor = (item: DraftItem | ListItem, price?: number | null) =>
		`• ${item.name} — ${item.quantity}${price != null ? ` · ₹${Math.round(price)}` : ""}${item.note ? ` (${item.note})` : ""}`;
	const lines = organizedItems ? organizedItems.map((item) => lineFor(item, item.estimatedPrice)) : items.map((item) => lineFor(item));
	let text = `மளிகை பட்டியல்:\n${lines.join("\n")}`;

	if (organizedItems) {
		const priced = organizedItems.filter((item) => item.estimatedPrice != null);
		if (priced.length > 0) {
			const total = priced.reduce((sum, item) => sum + (item.estimatedPrice ?? 0), 0);
			text += `\n\nமதிப்பிடப்பட்ட மொத்தம்: ₹${Math.round(total)}`;
		}
	}

	return text;
}

export function RecordingScreen() {
	const insets = useSafeAreaInsets();
	const [segments, setSegments] = useState<string[]>([]);
	const [listening, setListening] = useState(false);
	const [micError, setMicError] = useState<string | null>(null);
	// Live ledger, ticking in while the person is still talking (see
	// extract.ts's parseSegmentOps) - liveItemsRef mirrors liveItems so the
	// sequential ops queue below always reads the latest state instead of a
	// stale closure. opsChainRef serializes segment calls so two in-flight
	// ops results can't race and clobber each other applying against the
	// same base state.
	const [liveItems, setLiveItems] = useState<DraftItem[]>([]);
	const [pendingSegments, setPendingSegments] = useState<string[]>([]);
	const liveItemsRef = useRef<DraftItem[]>([]);
	const opsChainRef = useRef<Promise<void>>(Promise.resolve());
	const liveIdCounterRef = useRef(0);
	// finalized: mic session ended, controls switch from mic/Done to
	// Organize/share - the list itself stays liveItems throughout, no screen
	// swap. reconciling/highlightedIds back the silent reconciliation pass
	// (see handleDone) - the authoritative full-transcript result is diffed
	// against liveItems and only the rows that actually changed are flagged,
	// instead of replacing the whole visible list.
	const [finalized, setFinalized] = useState(false);
	const [reconciling, setReconciling] = useState(false);
	const [highlightedIds, setHighlightedIds] = useState<string[]>([]);
	const [organizedItems, setOrganizedItems] = useState<ListItem[] | null>(null);
	const [organizing, setOrganizing] = useState(false);
	const [lastList, setLastList] = useState<DraftItem[] | null>(null);
	const [frequentItems, setFrequentItems] = useState<FrequentItem[]>([]);
	const [model, setModel] = useState(DEFAULT_MODEL_ID);
	const [settingsVisible, setSettingsVisible] = useState(false);
	const [connected, setConnected] = useState(false);
	const [connecting, setConnecting] = useState(false);
	const [isAuto, setIsAuto] = useState(false);

	const hasContent = segments.length > 0 || finalized;

	const refreshConnectionState = useCallback(async () => {
		const key = await getOpenRouterKey();
		setConnected(!!key);
		setIsAuto(key ? await isAutoProvisionedKey() : false);
	}, []);

	useEffect(() => {
		getLastList().then(setLastList);
		getSelectedModel().then(setModel);
		refreshConnectionState();
		getFrequentItems()
			.then(setFrequentItems)
			.catch(() => {
				// not critical - the empty state just won't show quick-add chips
			});
	}, [refreshConnectionState]);

	// A free key can be auto-provisioned mid-request (see extract.ts) without
	// ever going through handleConnect, so this is the one place that needs
	// to react to OpenRouter-specific failures from any of the three calls -
	// shared so "Done" and "Organize" both word the prompt the same way.
	function handleOpenRouterError(error: unknown) {
		if (error instanceof OpenRouterLimitExceededError) {
			Alert.alert("இலவச வரம்பு முடிந்தது", "இந்த மாத இலவச பயன்பாடு முடிந்துவிட்டது. தொடர உங்கள் சொந்த OpenRouter கணக்கை இணைக்கவும்.", [
				{ text: "சரி", onPress: () => setSettingsVisible(true) },
			]);
		} else if (error instanceof OpenRouterNotConnectedError) {
			Alert.alert("இணைப்பு தேவை", "பட்டியலை உருவாக்க இணையம் தேவை - சரிபார்த்து மீண்டும் முயற்சிக்கவும், அல்லது அமைப்புகளில் இருந்து இணைக்கவும்.", [
				{ text: "சரி", onPress: () => setSettingsVisible(true) },
			]);
		} else {
			Alert.alert("பிழை", error instanceof Error ? error.message : String(error));
		}
	}

	async function handleSelectModel(id: string) {
		setModel(id);
		await setSelectedModel(id);
	}

	async function handleConnect() {
		setConnecting(true);
		try {
			await connectOpenRouter();
			await refreshConnectionState();
		} catch (error) {
			Alert.alert("இணைக்க முடியவில்லை", error instanceof Error ? error.message : String(error));
		} finally {
			setConnecting(false);
		}
	}

	async function handleDisconnect() {
		await disconnectOpenRouter();
		await refreshConnectionState();
	}

	useEffect(() => {
		liveItemsRef.current = liveItems;
	}, [liveItems]);

	const nextLiveId = useCallback(() => `live-${liveIdCounterRef.current++}`, []);

	// Runs one segment's ops call and applies the result - queued via
	// opsChainRef in addSegment below so calls never overlap. Failures are
	// swallowed on purpose: a segment that fails to parse live just never
	// ticks into the ledger, but it's still in `segments` and gets caught by
	// the authoritative full pass in handleDone, so nothing is lost.
	const runSegmentOps = useCallback(
		async (segmentText: string) => {
			try {
				const ops = await parseSegmentOps(liveItemsRef.current, segmentText);
				if (ops.length > 0) setLiveItems((prev) => applyOperations(prev, ops, nextLiveId));
			} catch (error) {
				console.error("Live segment parse failed - the final pass on Done will still catch it", error);
			} finally {
				setPendingSegments((prev) => {
					const index = prev.indexOf(segmentText);
					if (index === -1) return prev;
					return [...prev.slice(0, index), ...prev.slice(index + 1)];
				});
			}
		},
		[nextLiveId],
	);

	const addSegment = useCallback(
		(text: string) => {
			setSegments((prev) => [...prev, text]);
			setPendingSegments((prev) => [...prev, text]);
			opsChainRef.current = opsChainRef.current.then(() => runSegmentOps(text));
		},
		[runSegmentOps],
	);

	useSpeechRecognitionEvent("start", () => setListening(true));
	useSpeechRecognitionEvent("end", () => setListening(false));
	useSpeechRecognitionEvent("result", (event) => {
		const transcript = event.results[0]?.transcript?.trim();
		if (event.isFinal && transcript) addSegment(transcript);
	});
	useSpeechRecognitionEvent("error", (event) => {
		if (event.error === "no-speech" || event.error === "aborted") return;
		setMicError(event.error === "not-allowed" ? "மைக்ரோஃபோன் அனுமதி மறுக்கப்பட்டது." : "மைக்ரோஃபோனைத் தொடங்க முடியவில்லை.");
		setListening(false);
	});

	async function toggleListening() {
		if (listening) {
			ExpoSpeechRecognitionModule.stop();
			return;
		}
		setMicError(null);
		const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
		if (!permission.granted) {
			setMicError("மைக்ரோஃபோன் அனுமதி மறுக்கப்பட்டது.");
			return;
		}
		ExpoSpeechRecognitionModule.start({ lang: "ta-IN", continuous: true, interimResults: true });
	}

	// "Done" only visibly stops the mic - the list already on screen (built
	// live) doesn't get replaced. The authoritative full-transcript pass
	// still runs, but silently: reconcileWithLive diffs its result against
	// what's showing and only the rows that actually changed get touched
	// (and briefly highlighted) - if it agrees with the live parse, which is
	// the common case, nothing visibly happens at all.
	async function handleDone() {
		if (listening) ExpoSpeechRecognitionModule.stop();
		setFinalized(true);
		// Let any segment ops call still in flight settle first - otherwise it
		// could resolve after reconciliation and silently re-apply on top of
		// the just-reconciled list, undoing what reconciliation just fixed.
		await opsChainRef.current;
		const current = liveItemsRef.current;
		await saveFinalizedList(current);
		setLastList(current);
		await refreshConnectionState(); // a key may have just been auto-provisioned

		setReconciling(true);
		try {
			const authoritative = await extractItems(segments.join(" "), model);
			const { merged, changedIds } = reconcileWithLive(liveItemsRef.current, authoritative);
			setLiveItems(merged);
			await updateLastList(merged);
			setLastList(merged);
			if (changedIds.length > 0) {
				setHighlightedIds(changedIds);
				setTimeout(() => setHighlightedIds([]), 1800);
			}
		} catch (error) {
			handleOpenRouterError(error);
		} finally {
			setReconciling(false);
		}
	}

	async function handleOrganize() {
		setOrganizing(true);
		try {
			const categorized = await categorizeItems(liveItems, model);
			const priced = await estimatePrices(categorized, model);
			setOrganizedItems(priced);
		} catch (error) {
			handleOpenRouterError(error);
		} finally {
			setOrganizing(false);
		}
	}

	function handleDeleteItem(id: string) {
		const next = liveItems.filter((item) => item.id !== id);
		setLiveItems(next);
		setOrganizedItems((prev) => (prev ? prev.filter((item) => item.id !== id) : prev));
		setLastList(next);
		updateLastList(next).catch(() => {
			// best-effort - the in-memory state above is already correct either way
		});
	}

	const startNewList = useCallback(() => {
		ExpoSpeechRecognitionModule.stop();
		setSegments([]);
		setLiveItems([]);
		setPendingSegments([]);
		liveIdCounterRef.current = 0;
		opsChainRef.current = Promise.resolve();
		setFinalized(false);
		setReconciling(false);
		setHighlightedIds([]);
		setOrganizedItems(null);
	}, []);

	// Without this, the post-Done screen (or Settings) has nowhere to "pop
	// back" to, so the hardware back button falls through to Android's
	// default behavior and exits the app entirely instead of returning to
	// the recording view.
	useEffect(() => {
		if (!finalized && !settingsVisible) return;
		const sub = BackHandler.addEventListener("hardwareBackPress", () => {
			if (settingsVisible) setSettingsVisible(false);
			else startNewList();
			return true;
		});
		return () => sub.remove();
	}, [finalized, settingsVisible, startNewList]);

	async function handleWhatsAppShare() {
		const text = buildShareText(liveItems, organizedItems);
		await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
	}

	async function handleShare() {
		const text = buildShareText(liveItems, organizedItems);
		await Share.share({ message: text });
	}

	function handleShareAction(action: ShareAction) {
		if (action === "new") startNewList();
		else if (action === "whatsapp") handleWhatsAppShare();
		else if (action === "share") handleShare();
	}

	const grouped = useMemo(() => {
		if (!organizedItems) return [];
		return CATEGORIES.map((category) => ({
			category,
			items: organizedItems.filter((item) => item.category === category.id),
		})).filter((group) => group.items.length > 0);
	}, [organizedItems]);

	const priceSummary = useMemo(() => {
		if (!organizedItems) return null;
		const priced = organizedItems.filter((item) => item.estimatedPrice != null);
		if (priced.length === 0) return null;
		const total = priced.reduce((sum, item) => sum + (item.estimatedPrice ?? 0), 0);
		return { total, pricedCount: priced.length, totalCount: organizedItems.length };
	}, [organizedItems]);

	if (settingsVisible) {
		return (
			<SettingsScreen
				onClose={() => setSettingsVisible(false)}
				selectedModel={model}
				onSelectModel={handleSelectModel}
				connected={connected}
				isAuto={isAuto}
				connecting={connecting}
				onConnect={handleConnect}
				onDisconnect={handleDisconnect}
			/>
		);
	}

	return (
		<View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 10 }]}>
			<StatusBar barStyle="dark-content" />
			<View style={styles.header}>
				<View style={styles.headerLeft}>
					<ShoppingBagIcon weight="duotone" size={18} color={colors.accent} />
					<Text style={styles.title}>மளிகை பட்டியல்</Text>
					{reconciling && (
						<View style={styles.reconcilingDots}>
							<LoaderDots variant="fun" />
						</View>
					)}
				</View>
				<View style={styles.headerRight}>
					{hasContent && (
						<PressableScale style={styles.newListButton} onPress={startNewList}>
							<FilePlusIcon weight="regular" size={14} color={colors.text} />
							<Text style={styles.newListButtonText}>புதியது</Text>
						</PressableScale>
					)}
					<PressableScale
						style={[styles.settingsButton, !connected && styles.settingsButtonAttention]}
						onPress={() => setSettingsVisible(true)}
					>
						<GearIcon weight="regular" size={16} color={connected ? colors.textMuted : colors.accent} />
					</PressableScale>
				</View>
			</View>

			{!hasContent ? (
				<View style={styles.emptyState}>
					<BasketIcon weight="regular" size={44} color={colors.accent} />
					<Text style={styles.placeholder}>பேசும்போது உங்கள் வார்த்தைகள் இங்கே தோன்றும்.</Text>
					{frequentItems.length > 0 && (
						<View style={styles.chipsRow}>
							{frequentItems.map((item) => (
								<PressableScale key={item.name} style={styles.chip} onPress={() => addSegment(`${item.name} ${item.quantity} வேணும்.`)}>
									<Text style={styles.chipText}>{item.name}</Text>
								</PressableScale>
							))}
						</View>
					)}
					{lastList && lastList.length > 0 && (
						<PressableScale
							style={styles.lastListLink}
							onPress={() => {
								setLiveItems(lastList);
								setOrganizedItems(null);
								setFinalized(true);
							}}
						>
							<ClockIcon weight="regular" size={13} color={colors.textMuted} />
							<Text style={styles.lastListLinkText}>கடைசி பட்டியலைப் பார்</Text>
						</PressableScale>
					)}
				</View>
			) : (
				<ScrollView style={styles.itemScroll} contentContainerStyle={styles.itemScrollContent}>
					{finalized && !organizedItems && (
						<AccentButton onPress={handleOrganize} disabled={organizing} style={styles.organizeButton}>
							{organizing ? (
								<>
									<LoaderDots variant="onAccent" />
									<Text style={styles.organizeButtonText}>வகைப்படுத்துகிறேன்…</Text>
								</>
							) : (
								<>
									<MagicWandIcon weight="fill" size={17} color={colors.onAccent} />
									<Text style={styles.organizeButtonText}>வகைப்படுத்தி விலை காட்டு</Text>
								</>
							)}
						</AccentButton>
					)}

					{priceSummary && (
						<Text style={styles.priceSummary}>
							மதிப்பிடப்பட்ட மொத்தம்: ₹{Math.round(priceSummary.total)}
							{priceSummary.pricedCount < priceSummary.totalCount && ` (${priceSummary.pricedCount}/${priceSummary.totalCount} பொருட்களுக்கு)`}
						</Text>
					)}

					{!organizedItems ? (
						<View style={styles.itemListCard}>
							{liveItems.map((item, i) => (
								<PopIn key={item.id} delay={i * 20}>
									<ItemRow
										item={item}
										divider={i < liveItems.length - 1 || pendingSegments.length > 0}
										onDelete={listening ? undefined : handleDeleteItem}
										highlighted={highlightedIds.includes(item.id)}
									/>
								</PopIn>
							))}
							{pendingSegments.map((segment, i) => (
								<PopIn key={`pending-${i}`}>
									<View style={[styles.itemRow, i < pendingSegments.length - 1 && styles.itemRowDivider]}>
										<Text style={styles.ghost} numberOfLines={1}>
											{segment}
										</Text>
									</View>
								</PopIn>
							))}
						</View>
					) : (
						grouped.map((group, gi) => {
							const CategoryIcon = categoryIcon(group.category.id);
							return (
								<PopIn key={group.category.id} delay={gi * 60}>
									<View style={styles.group}>
										<View style={styles.groupHeader}>
											<CategoryIcon weight="regular" size={14} color={categoryColor(group.category.id)} />
											<Text style={[styles.groupTitle, { color: categoryColor(group.category.id) }]}>{group.category.ta}</Text>
										</View>
										<View style={styles.itemListCard}>
											{group.items.map((item, i) => (
												<PopIn key={item.id} delay={i * 30}>
													<ItemRow item={item} divider={i < group.items.length - 1} onDelete={handleDeleteItem} />
												</PopIn>
											))}
										</View>
									</View>
								</PopIn>
							);
						})
					)}
				</ScrollView>
			)}

			{micError && <Text style={styles.error}>{micError}</Text>}

			{!finalized ? (
				// Mic is the one fixed anchor on this screen - it must never move,
				// so it's centered independently of everything else, not sharing a
				// flex row with Done (which would re-center the whole row and make
				// mic visibly jump sideways the moment Done appears). Done is a
				// separate, absolutely-positioned, secondary-weight control that
				// slots in beside it without ever touching mic's position.
				<View style={styles.controlsArea}>
					<MicButton recording={listening} onPress={toggleListening} size={72} />
					{segments.length > 0 && (
						<PopIn style={styles.doneSlot}>
							<PressableScale style={styles.doneButton} onPress={handleDone}>
								<SealCheckIcon weight="fill" size={22} color={colors.accent} />
							</PressableScale>
						</PopIn>
					)}
				</View>
			) : (
				<View style={styles.shareActionsRow}>
					<ConfettiBurst />
					{SHARE_ACTIONS.map((action, i) => (
						<PopIn key={action.action} delay={i * 40}>
							<ShareIconButton action={action} onPress={() => handleShareAction(action.action)} />
						</PopIn>
					))}
				</View>
			)}
		</View>
	);
}

// A flagged item shows why (note and/or the reason it was guessed) as a
// muted subtitle line under the name - the badge alone told the user
// *something* needed a look, this tells them what.
// onDelete is optional so the same row can render read-only while the mic
// is actively listening (hands are busy - see the recording-view usage
// above) without needing a second component. highlighted briefly marks a
// row silent reconciliation changed after "Done" (see handleDone).
function ItemRow({
	item,
	divider,
	onDelete,
	highlighted,
}: {
	item: DraftItem | ListItem;
	divider: boolean;
	onDelete?: (id: string) => void;
	highlighted?: boolean;
}) {
	const price = "estimatedPrice" in item && item.estimatedPrice != null ? item.estimatedPrice : null;
	const subtextParts = [item.note, item.needsConfirmation && item.confirmationReason ? REASON_LABELS[item.confirmationReason] : null].filter(
		(part): part is string => !!part,
	);

	function confirmDelete() {
		Alert.alert("பொருளை நீக்கவா?", item.name, [
			{ text: "ரத்து செய்", style: "cancel" },
			{ text: "நீக்கு", style: "destructive", onPress: () => onDelete?.(item.id) },
		]);
	}

	return (
		<View style={[styles.itemRow, divider && styles.itemRowDivider, highlighted && styles.itemRowHighlighted]}>
			<View style={styles.itemMain}>
				<View style={styles.itemNameRow}>
					{item.needsConfirmation && <WarningCircleIcon weight="fill" size={14} color={colors.fun.gold} />}
					<Text style={styles.itemName}>{item.name}</Text>
				</View>
				{subtextParts.length > 0 && <Text style={styles.itemSubtext}>{subtextParts.join(" · ")}</Text>}
			</View>
			<Text style={styles.itemQty}>
				{item.quantity}
				{price != null && ` · ₹${Math.round(price)}`}
			</Text>
			{onDelete && (
				<PressableScale onPress={confirmDelete} accessibilityLabel="நீக்கு" style={styles.deleteButton}>
					<TrashSimpleIcon weight="regular" size={15} color={colors.textMuted} />
				</PressableScale>
			)}
		</View>
	);
}

// Same rounded-square shape/size for all three (consistency), but a
// bold-duotone icon in its own fun-palette color for personality - solid
// surface background + a real shadow (see the backgroundColor comment
// below), not a gradient, since a near-white-to-near-white gradient was
// too subtle to read as a gradient at all.
function ShareIconButton({
	action,
	onPress,
}: {
	action: { Icon: Icon; label: string; color: string };
	onPress: () => void;
}) {
	const { Icon } = action;
	return (
		<PressableScale onPress={onPress} accessibilityLabel={action.label} style={styles.iconButton}>
			<Icon weight="duotone" size={24} color={action.color} duotoneColor={action.color} duotoneOpacity={0.35} />
		</PressableScale>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.bg,
		paddingHorizontal: 18,
		alignItems: "center",
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		width: "100%",
		marginBottom: 10,
	},
	headerLeft: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
	},
	headerRight: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	reconcilingDots: {
		transform: [{ scale: 0.5 }],
	},
	settingsButton: {
		width: 28,
		height: 28,
		borderRadius: radius.sm,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1.2,
		borderColor: colors.borderStrong,
		backgroundColor: colors.surface,
	},
	settingsButtonAttention: {
		borderColor: colors.accent,
		backgroundColor: colors.accentSoft,
	},
	title: {
		fontSize: 16,
		fontFamily: fontFamily.extrabold,
		color: colors.text,
	},
	newListButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		paddingHorizontal: 10,
		paddingVertical: 5,
		borderRadius: radius.sm,
		borderWidth: 1.2,
		borderColor: colors.borderStrong,
		backgroundColor: colors.surface,
	},
	newListButtonText: {
		fontSize: 11,
		fontFamily: fontFamily.bold,
		color: colors.text,
	},
	emptyState: {
		flex: 1,
		width: "100%",
		alignItems: "center",
		justifyContent: "center",
		gap: 10,
		paddingHorizontal: 24,
	},
	placeholder: {
		color: colors.textMuted,
		fontFamily: fontFamily.semibold,
		fontSize: 13,
		textAlign: "center",
	},
	chipsRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "center",
		gap: 6,
		paddingHorizontal: 12,
	},
	chip: {
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 999,
		borderWidth: 1,
		borderColor: colors.borderStrong,
		backgroundColor: colors.surface,
	},
	chipText: {
		fontSize: 12,
		fontFamily: fontFamily.semibold,
		color: colors.text,
	},
	lastListLink: {
		flexDirection: "row",
		alignItems: "center",
		gap: 5,
		marginTop: 10,
		alignSelf: "center",
	},
	lastListLinkText: {
		color: colors.textMuted,
		fontFamily: fontFamily.semibold,
		fontSize: 12,
	},
	error: {
		color: colors.danger,
		fontFamily: fontFamily.medium,
		fontSize: 12,
		marginBottom: 4,
		textAlign: "center",
	},
	// position:'relative' + alignItems/justifyContent:'center' centers mic
	// independently of anything else in here - doneSlot is taken out of flow
	// entirely (position:'absolute'), so it can never shift mic's position.
	controlsArea: {
		position: "relative",
		width: "100%",
		height: 104,
		alignItems: "center",
		justifyContent: "center",
	},
	doneSlot: {
		position: "absolute",
		top: 0,
		bottom: 0,
		right: 12,
		justifyContent: "center",
	},
	doneButton: {
		width: 48,
		height: 48,
		borderRadius: radius.sm,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: colors.accentSoft,
	},
	itemScroll: {
		flex: 1,
		width: "100%",
	},
	itemScrollContent: {
		paddingVertical: 8,
	},
	organizeButton: {
		marginBottom: 12,
	},
	organizeButtonText: {
		color: colors.onAccent,
		fontFamily: fontFamily.bold,
		fontSize: 15,
	},
	priceSummary: {
		fontSize: 14,
		fontFamily: fontFamily.bold,
		color: colors.text,
		backgroundColor: colors.accentSoft,
		padding: 12,
		borderRadius: radius.sm,
		marginBottom: 12,
	},
	group: {
		gap: 8,
		marginBottom: 16,
	},
	groupHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		marginBottom: 6,
	},
	groupTitle: {
		fontSize: 12,
		fontFamily: fontFamily.extrabold,
		letterSpacing: 0.5,
		textTransform: "uppercase",
	},
	// Single card containing all rows with a dashed rule between them,
	// matching the web app's draft-item-list - not separate cards per item.
	itemListCard: {
		backgroundColor: colors.surface,
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radius.md,
		paddingHorizontal: 4,
	},
	itemRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
		paddingHorizontal: 12,
		paddingVertical: 10,
		gap: 8,
	},
	itemRowDivider: {
		borderBottomWidth: 1,
		borderStyle: "dashed",
		borderBottomColor: colors.borderStrong,
	},
	// Brief flag on a row silent reconciliation changed after "Done" (see
	// handleDone) - cleared a couple seconds later, no animation needed for
	// this pass.
	itemRowHighlighted: {
		backgroundColor: colors.accentSoft,
	},
	itemMain: {
		flex: 1,
		gap: 2,
	},
	itemNameRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 5,
	},
	itemName: {
		fontSize: 14,
		fontFamily: fontFamily.medium,
		color: colors.text,
		flexShrink: 1,
	},
	itemSubtext: {
		fontSize: 11,
		fontFamily: fontFamily.medium,
		color: colors.textMuted,
		fontStyle: "italic",
	},
	itemQty: {
		fontSize: 12,
		fontFamily: fontFamily.medium,
		color: colors.textMuted,
	},
	deleteButton: {
		width: 26,
		height: 26,
		alignItems: "center",
		justifyContent: "center",
	},
	ghost: {
		flex: 1,
		fontSize: 13,
		fontFamily: fontFamily.medium,
		color: colors.textMuted,
		fontStyle: "italic",
	},
	shareActionsRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 16,
		paddingVertical: 10,
		position: "relative",
	},
	iconButton: {
		width: 52,
		height: 52,
		borderRadius: radius.sm,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: colors.surface,
		borderWidth: 1,
		borderColor: colors.border,
	},
});
