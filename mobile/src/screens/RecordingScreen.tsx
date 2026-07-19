import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, BackHandler, Linking, ScrollView, Share, StatusBar, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import {
	BasketIcon,
	ClockIcon,
	FilePlusIcon,
	GearIcon,
	MagicWandIcon,
	MicrophoneIcon,
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
import { SettingsScreen, type SettingsRoute } from "./SettingsScreen";
import { enrichItems, extractItems, OpenRouterLimitExceededError, OpenRouterNotConnectedError } from "../lib/extract";
import { getFrequentItems, getLastList, saveFinalizedList, updateLastList } from "../lib/listHistory";
import { connectOpenRouter, disconnectOpenRouter, getOpenRouterKey, isAutoProvisionedKey } from "../lib/openrouterAuth";
import { CATEGORIES } from "../shared/categories";
import { categoryColor } from "../lib/categoryColors";
import { categoryIcon } from "../lib/categoryIcons";
import { colors, duration, fontFamily, radius } from "../theme/tokens";
import type { ConfirmationReason, Item } from "../shared/types";

const REASON_LABELS: Record<ConfirmationReason, string> = {
	vague_quantity: "தெளிவற்ற அளவு",
	inferred_unit: "யூகிக்கப்பட்ட அலகு",
	default_quantity: "இயல்பு அளவு",
	uncertain_item_name: "உறுதியில்லாத பெயர்",
	uncertain_brand: "உறுதியில்லாத பிராண்ட்",
	ambiguous_merge: "தெளிவற்ற இணைப்பு",
};

// How long to wait after the last finalized speech segment before actually
// calling the model - talking fast otherwise queues up one full-context call
// per segment and the visible list lags noticeably behind speech.
const LIVE_REPARSE_DEBOUNCE_MS = 550;

type ShareAction = "continue" | "whatsapp" | "share" | "clear";
const SHARE_ACTIONS: Array<{ action: ShareAction; Icon: Icon; label: string; color: string }> = [
	{ action: "continue", Icon: MicrophoneIcon, label: "தொடரவும்", color: colors.fun.sage },
	{ action: "whatsapp", Icon: WhatsappLogoIcon, label: "WhatsApp", color: colors.fun.blue },
	{ action: "share", Icon: ShareNetworkIcon, label: "பகிரவும்", color: colors.fun.berry },
	{ action: "clear", Icon: FilePlusIcon, label: "புதியது", color: colors.fun.gold },
];

function buildShareText(items: Item[]): string {
	const priced = items.filter((item) => item.estimatedPrice != null);
	const lines = items.map(
		(item) => `• ${item.name} — ${item.quantity}${item.estimatedPrice != null ? ` · ₹${Math.round(item.estimatedPrice)}` : ""}${item.note ? ` (${item.note})` : ""}`,
	);
	let text = `மளிகை பட்டியல்:\n${lines.join("\n")}`;

	if (priced.length > 0) {
		const total = priced.reduce((sum, item) => sum + (item.estimatedPrice ?? 0), 0);
		text += `\n\nமதிப்பிடப்பட்ட மொத்தம்: ₹${Math.round(total)}`;
	}

	return text;
}

export function RecordingScreen() {
	const insets = useSafeAreaInsets();
	// The raw transcript, one entry per finalized speech segment - the sole
	// input to every live re-parse (see runLiveReparse below). Never edited or
	// trimmed by manual actions (delete, enrich) - only appended to while
	// recording and cleared on Clear.
	const [segments, setSegments] = useState<string[]>([]);
	const [listening, setListening] = useState(false);
	const [micError, setMicError] = useState<string | null>(null);
	// The one and only list state - always either the result of the latest
	// live re-parse, an on-demand enrichment, or a manual edit. No separate
	// "draft" vs "organized" shape (see shared/types.ts's Item) and no
	// per-row diffing against the previous value - refreshing below just
	// dims the whole list while a fresh result is in flight, then swaps it
	// in wholesale.
	const [items, setItems] = useState<Item[]>([]);
	const [refreshing, setRefreshing] = useState(false);
	const [enriching, setEnriching] = useState(false);
	const itemsRef = useRef<Item[]>([]);
	const segmentsRef = useRef<string[]>([]);
	// Guards against a stale response overwriting a newer one when two live
	// calls happen to be in flight at once (slow network + fast talking) -
	// only the response whose id still matches the latest issued gets
	// applied. Replaces the old opsChainRef serialization entirely: there's
	// no ordered queue to maintain, just "does anyone care about this
	// response anymore".
	const requestIdRef = useRef(0);
	const inFlightRef = useRef<Promise<void>>(Promise.resolve());
	const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [lastList, setLastList] = useState<Item[] | null>(null);
	const [frequentItems, setFrequentItems] = useState<{ name: string; quantity: string }[]>([]);
	const [settingsVisible, setSettingsVisible] = useState(false);
	// "connect" when an OpenRouter error sends the user to Settings to fix it
	// (see handleOpenRouterError) - Connect is hidden from the Settings menu
	// for now, so this is the only way in, opened directly rather than
	// requiring a menu hunt while already blocked. "menu" (the default) for
	// every other way of opening Settings (the gear icon).
	const [settingsInitialRoute, setSettingsInitialRoute] = useState<SettingsRoute>("menu");
	const [connected, setConnected] = useState(false);
	const [connecting, setConnecting] = useState(false);
	const [isAuto, setIsAuto] = useState(false);

	// Stopped-with-content is the only "mode" this screen has - everything
	// else (empty state vs list, mic vs share/clear/continue row) derives
	// from these two booleans, not a stored flag.
	const stopped = !listening && items.length > 0;

	const refreshOpacity = useSharedValue(1);
	useEffect(() => {
		refreshOpacity.value = withTiming(refreshing ? 0.45 : 1, { duration: duration.base });
	}, [refreshing, refreshOpacity]);
	const refreshAnimatedStyle = useAnimatedStyle(() => ({ opacity: refreshOpacity.value }));

	const refreshConnectionState = useCallback(async () => {
		const key = await getOpenRouterKey();
		setConnected(!!key);
		setIsAuto(key ? await isAutoProvisionedKey() : false);
	}, []);

	useEffect(() => {
		getLastList().then(setLastList);
		refreshConnectionState();
		getFrequentItems()
			.then(setFrequentItems)
			.catch(() => {
				// not critical - the empty state just won't show quick-add chips
			});
	}, [refreshConnectionState]);

	// A free key can be auto-provisioned mid-request (see extract.ts) without
	// ever going through handleConnect, so this is the one place that needs
	// to react to OpenRouter-specific failures from any call.
	function handleOpenRouterError(error: unknown) {
		const goToConnect = () => {
			setSettingsInitialRoute("connect");
			setSettingsVisible(true);
		};
		if (error instanceof OpenRouterLimitExceededError) {
			Alert.alert("இலவச வரம்பு முடிந்தது", "இந்த மாத இலவச பயன்பாடு முடிந்துவிட்டது. தொடர உங்கள் சொந்த OpenRouter கணக்கை இணைக்கவும்.", [
				{ text: "சரி", onPress: goToConnect },
			]);
		} else if (error instanceof OpenRouterNotConnectedError) {
			Alert.alert("இணைப்பு தேவை", "பட்டியலை உருவாக்க இணையம் தேவை - சரிபார்த்து மீண்டும் முயற்சிக்கவும், அல்லது அமைப்புகளில் இருந்து இணைக்கவும்.", [
				{ text: "சரி", onPress: goToConnect },
			]);
		} else {
			Alert.alert("பிழை", error instanceof Error ? error.message : String(error));
		}
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
		itemsRef.current = items;
	}, [items]);

	useEffect(() => {
		segmentsRef.current = segments;
	}, [segments]);

	// The one live re-parse call, always deriving the full list fresh from
	// the transcript-so-far (see segmentsRef) - never a diff against what's
	// currently showing. silent=true (the debounced mid-dictation path)
	// swallows failures since the next segment or the stop-flush will retry;
	// silent=false (the stop-flush path) rethrows so the caller can surface
	// an OpenRouter error to the user.
	const runLiveReparse = useCallback(async (silent: boolean) => {
		const transcriptSoFar = segmentsRef.current.join(" ");
		const myRequestId = ++requestIdRef.current;
		setRefreshing(true);
		try {
			const result = await extractItems(transcriptSoFar);
			if (requestIdRef.current === myRequestId) setItems(result);
		} catch (error) {
			if (!silent) throw error;
			console.error("Live re-parse failed - will retry on the next segment or when recording stops", error);
		} finally {
			if (requestIdRef.current === myRequestId) setRefreshing(false);
		}
	}, []);

	const scheduleLiveReparse = useCallback(() => {
		if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
		debounceTimerRef.current = setTimeout(() => {
			debounceTimerRef.current = null;
			inFlightRef.current = runLiveReparse(true);
		}, LIVE_REPARSE_DEBOUNCE_MS);
	}, [runLiveReparse]);

	// Called when recording stops (see the listening-transition effect below)
	// - cancels any pending debounce, lets whatever's already in flight
	// settle, then runs one authoritative, non-silent call so the final list
	// is always derived from the complete transcript on the one shared model,
	// and any connection error actually reaches the user at the moment they
	// expect a finished list.
	const flushLiveReparse = useCallback(async () => {
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current);
			debounceTimerRef.current = null;
		}
		await inFlightRef.current.catch(() => {});
		const call = runLiveReparse(false);
		inFlightRef.current = call.catch(() => {});
		await call;
	}, [runLiveReparse]);

	const addSegment = useCallback(
		(text: string) => {
			setSegments((prev) => [...prev, text]);
			scheduleLiveReparse();
		},
		[scheduleLiveReparse],
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

	async function startListening() {
		setMicError(null);
		const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
		if (!permission.granted) {
			setMicError("மைக்ரோஃபோன் அனுமதி மறுக்கப்பட்டது.");
			return;
		}
		ExpoSpeechRecognitionModule.start({ lang: "ta-IN", continuous: true, interimResults: true });
	}

	function toggleListening() {
		if (listening) ExpoSpeechRecognitionModule.stop();
		else startListening();
	}

	// Runs every time recording stops, whether the person tapped the mic to
	// stop it or the OS ended it on its own (silence timeout) - "Continue"
	// exists precisely so an unexpected auto-stop isn't a dead end.
	const prevListeningRef = useRef(false);
	useEffect(() => {
		if (prevListeningRef.current && !listening && segmentsRef.current.length > 0) {
			settleAfterStop();
		}
		prevListeningRef.current = listening;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [listening]);

	async function settleAfterStop() {
		await saveFinalizedList(itemsRef.current);
		setLastList(itemsRef.current);
		await refreshConnectionState(); // a key may have just been auto-provisioned
		try {
			await flushLiveReparse();
			await updateLastList(itemsRef.current);
			setLastList(itemsRef.current);
		} catch (error) {
			handleOpenRouterError(error);
		}
	}

	async function handleEnrich() {
		setEnriching(true);
		try {
			const result = await enrichItems(itemsRef.current);
			setItems(result);
			await updateLastList(result);
			setLastList(result);
		} catch (error) {
			handleOpenRouterError(error);
		} finally {
			setEnriching(false);
		}
	}

	function handleDeleteItem(id: string) {
		const next = itemsRef.current.filter((item) => item.id !== id);
		setItems(next);
		setLastList(next);
		updateLastList(next).catch(() => {
			// best-effort - the in-memory state above is already correct either way
		});
	}

	const startNewList = useCallback(() => {
		ExpoSpeechRecognitionModule.stop();
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current);
			debounceTimerRef.current = null;
		}
		requestIdRef.current += 1; // invalidate any response still in flight
		inFlightRef.current = Promise.resolve();
		setSegments([]);
		setItems([]);
		setRefreshing(false);
		setEnriching(false);
	}, []);

	// Without this, the Settings screen (or the stopped/share view) has
	// nowhere to "pop back" to, so the hardware back button falls through to
	// Android's default behavior and exits the app entirely instead of
	// dismissing back to a fresh recording view.
	useEffect(() => {
		if (!stopped && !settingsVisible) return;
		const sub = BackHandler.addEventListener("hardwareBackPress", () => {
			if (settingsVisible) setSettingsVisible(false);
			else startNewList();
			return true;
		});
		return () => sub.remove();
	}, [stopped, settingsVisible, startNewList]);

	async function handleWhatsAppShare() {
		const text = buildShareText(items);
		await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
	}

	async function handleShare() {
		const text = buildShareText(items);
		await Share.share({ message: text });
	}

	function handleShareAction(action: ShareAction) {
		if (action === "clear") startNewList();
		else if (action === "continue") startListening();
		else if (action === "whatsapp") handleWhatsAppShare();
		else if (action === "share") handleShare();
	}

	// Only offer "continue recording" when this list actually has live
	// speech behind it in this session - a list loaded via "last list" has
	// no transcript, and resuming the mic onto it would make the next live
	// re-parse (which always derives fresh from segments) silently discard
	// it, since items and segments would no longer correspond to each other.
	const availableActions = useMemo(
		() => SHARE_ACTIONS.filter((action) => action.action !== "continue" || segments.length > 0),
		[segments.length],
	);

	// Grouped-by-category view only once every item has been through
	// Organize - a mixed categorized/uncategorized list just stays flat
	// rather than silently dropping the not-yet-categorized rows from view.
	const grouped = useMemo(() => {
		if (items.length === 0 || items.some((item) => item.category === null)) return null;
		return CATEGORIES.map((category) => ({
			category,
			items: items.filter((item) => item.category === category.id),
		})).filter((group) => group.items.length > 0);
	}, [items]);

	const priceSummary = useMemo(() => {
		if (!grouped) return null;
		const priced = items.filter((item) => item.estimatedPrice != null);
		if (priced.length === 0) return null;
		const total = priced.reduce((sum, item) => sum + (item.estimatedPrice ?? 0), 0);
		return { total, pricedCount: priced.length, totalCount: items.length };
	}, [grouped, items]);

	const recentSegments = segments.slice(-2);

	if (settingsVisible) {
		return (
			<SettingsScreen
				onClose={() => setSettingsVisible(false)}
				initialRoute={settingsInitialRoute}
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
				</View>
				<View style={styles.headerRight}>
					{items.length > 0 && (
						<PressableScale style={styles.newListButton} onPress={startNewList}>
							<FilePlusIcon weight="regular" size={14} color={colors.text} />
							<Text style={styles.newListButtonText}>புதியது</Text>
						</PressableScale>
					)}
					<PressableScale
						style={[styles.settingsButton, !connected && styles.settingsButtonAttention]}
						onPress={() => {
							setSettingsInitialRoute("menu");
							setSettingsVisible(true);
						}}
					>
						<GearIcon weight="regular" size={16} color={connected ? colors.textMuted : colors.accent} />
					</PressableScale>
				</View>
			</View>

			{segments.length > 0 && (
				<View style={styles.recentSegments}>
					{recentSegments.map((segment, i) => (
						<Text key={`${i}-${segment}`} style={styles.ghost} numberOfLines={1}>
							{segment}
						</Text>
					))}
				</View>
			)}

			{items.length === 0 ? (
				<View style={styles.emptyState}>
					<BasketIcon weight="regular" size={44} color={colors.accent} />
					<Text style={styles.placeholder}>பேசும்போது உங்கள் வார்த்தைகள் இங்கே தோன்றும்.</Text>
					{!listening && frequentItems.length > 0 && (
						<View style={styles.chipsRow}>
							{frequentItems.map((item) => (
								<PressableScale key={item.name} style={styles.chip} onPress={() => addSegment(`${item.name} ${item.quantity} வேணும்.`)}>
									<Text style={styles.chipText}>{item.name}</Text>
								</PressableScale>
							))}
						</View>
					)}
					{!listening && lastList && lastList.length > 0 && (
						<PressableScale
							style={styles.lastListLink}
							onPress={() => {
								setItems(lastList);
							}}
						>
							<ClockIcon weight="regular" size={13} color={colors.textMuted} />
							<Text style={styles.lastListLinkText}>கடைசி பட்டியலைப் பார்</Text>
						</PressableScale>
					)}
				</View>
			) : (
				<ScrollView style={styles.itemScroll} contentContainerStyle={styles.itemScrollContent}>
					{stopped && !grouped && (
						<AccentButton onPress={handleEnrich} disabled={enriching} style={styles.organizeButton}>
							{enriching ? (
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

					<Animated.View style={refreshAnimatedStyle}>
						{!grouped ? (
							<View style={styles.itemListCard}>
								{items.map((item, i) => (
									<PopIn key={item.id} delay={i * 20}>
										<ItemRow item={item} divider={i < items.length - 1} onDelete={listening ? undefined : handleDeleteItem} />
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
					</Animated.View>
				</ScrollView>
			)}

			{micError && <Text style={styles.error}>{micError}</Text>}

			{!stopped ? (
				<View style={styles.controlsArea}>
					<MicButton recording={listening} onPress={toggleListening} size={48} />
				</View>
			) : (
				<View style={styles.shareActionsRow}>
					<ConfettiBurst />
					{availableActions.map((action, i) => (
						<PopIn key={action.action} delay={i * 40}>
							<ShareIconButton action={action} onPress={() => handleShareAction(action.action)} />
						</PopIn>
					))}
				</View>
			)}
		</View>
	);
}

function ItemRow({
	item,
	divider,
	onDelete,
}: {
	item: Item;
	divider: boolean;
	onDelete?: (id: string) => void;
}) {
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
		<View style={[styles.itemRow, divider && styles.itemRowDivider]}>
			<View style={styles.itemMain}>
				<View style={styles.itemNameRow}>
					{item.needsConfirmation && <WarningCircleIcon weight="fill" size={14} color={colors.fun.gold} />}
					<Text style={styles.itemName}>{item.name}</Text>
				</View>
				{subtextParts.length > 0 && <Text style={styles.itemSubtext}>{subtextParts.join(" · ")}</Text>}
			</View>
			<Text style={styles.itemQty}>
				{item.quantity}
				{item.estimatedPrice != null && ` · ₹${Math.round(item.estimatedPrice)}`}
			</Text>
			{onDelete && (
				<PressableScale onPress={confirmDelete} accessibilityLabel="நீக்கு" style={styles.deleteButton}>
					<TrashSimpleIcon weight="regular" size={15} color={colors.textMuted} />
				</PressableScale>
			)}
		</View>
	);
}

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
	// Fixed-height reserved space so layout doesn't jump as segments arrive -
	// shows the last couple of things heard, separate from the formatted
	// list below (see the "what you said" preview in the design discussion).
	recentSegments: {
		width: "100%",
		minHeight: 34,
		justifyContent: "center",
		marginBottom: 6,
		backgroundColor: colors.surfaceAlt,
		borderRadius: radius.sm,
		paddingHorizontal: 10,
		paddingVertical: 6,
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
	controlsArea: {
		width: "100%",
		height: 104,
		alignItems: "center",
		justifyContent: "center",
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
		fontSize: 11,
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
