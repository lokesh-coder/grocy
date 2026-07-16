import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, BackHandler, Linking, ScrollView, Share, StatusBar, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
	BasketIcon,
	ClipboardTextIcon,
	ClockIcon,
	FilePlusIcon,
	GearIcon,
	MagicWandIcon,
	QuestionIcon,
	SealCheckIcon,
	ShareNetworkIcon,
	ShoppingBagIcon,
	WhatsappLogoIcon,
	type Icon,
} from "phosphor-react-native";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { SegmentsList } from "../components/SegmentsList";
import { MicButton } from "../components/MicButton";
import { LoaderDots } from "../components/LoaderDots";
import { PopIn } from "../components/PopIn";
import { PressableScale } from "../components/PressableScale";
import { ConfettiBurst } from "../components/ConfettiBurst";
import { AccentButton } from "../components/AccentButton";
import { SettingsModal } from "../components/SettingsModal";
import { HelpModal } from "../components/HelpModal";
import { categorizeItems, estimatePrices, extractItems } from "../lib/extract";
import { getFrequentItems, getLastList, saveFinalizedList } from "../lib/listHistory";
import { getSelectedModel, setSelectedModel } from "../lib/modelSettings";
import { DEFAULT_MODEL_ID } from "../lib/models";
import { connectOpenRouter, disconnectOpenRouter, getOpenRouterKey } from "../lib/openrouterAuth";
import { CATEGORIES } from "../shared/categories";
import { categoryColor } from "../lib/categoryColors";
import { categoryIcon } from "../lib/categoryIcons";
import { colors, fontFamily, radius } from "../theme/tokens";
import type { DraftItem, ListItem } from "../shared/types";

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
	const lines = organizedItems
		? organizedItems.map((item) => `• ${item.name} — ${item.quantity}${item.estimatedPrice != null ? ` · ₹${Math.round(item.estimatedPrice)}` : ""}`)
		: items.map((item) => `• ${item.name} — ${item.quantity}`);
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
	const [finalizing, setFinalizing] = useState(false);
	const [finalized, setFinalized] = useState(false);
	const [finalizedItems, setFinalizedItems] = useState<DraftItem[]>([]);
	const [organizedItems, setOrganizedItems] = useState<ListItem[] | null>(null);
	const [organizing, setOrganizing] = useState(false);
	const [lastList, setLastList] = useState<DraftItem[] | null>(null);
	const [frequentItems, setFrequentItems] = useState<FrequentItem[]>([]);
	const [model, setModel] = useState(DEFAULT_MODEL_ID);
	const [settingsVisible, setSettingsVisible] = useState(false);
	const [helpVisible, setHelpVisible] = useState(false);
	const [connected, setConnected] = useState(false);
	const [connecting, setConnecting] = useState(false);

	const hasContent = segments.length > 0 || finalized;

	useEffect(() => {
		getLastList().then(setLastList);
		getSelectedModel().then(setModel);
		getOpenRouterKey().then((key) => setConnected(!!key));
		getFrequentItems()
			.then(setFrequentItems)
			.catch(() => {
				// not critical - the empty state just won't show quick-add chips
			});
	}, []);

	async function handleSelectModel(id: string) {
		setModel(id);
		setSettingsVisible(false);
		await setSelectedModel(id);
	}

	async function handleConnect() {
		setConnecting(true);
		try {
			await connectOpenRouter();
			setConnected(true);
			setSettingsVisible(false);
		} catch (error) {
			Alert.alert("இணைக்க முடியவில்லை", error instanceof Error ? error.message : String(error));
		} finally {
			setConnecting(false);
		}
	}

	async function handleDisconnect() {
		await disconnectOpenRouter();
		setConnected(false);
	}

	const addSegment = useCallback((text: string) => {
		setSegments((prev) => [...prev, text]);
	}, []);

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

	async function handleDone() {
		if (listening) ExpoSpeechRecognitionModule.stop();
		if (!connected) {
			setSettingsVisible(true);
			return;
		}
		setFinalizing(true);
		try {
			const items = await extractItems(segments.join(" "), model);
			await saveFinalizedList(items);
			setLastList(items);
			setFinalizedItems(items);
			setOrganizedItems(null);
			setFinalized(true);
		} finally {
			setFinalizing(false);
		}
	}

	async function handleOrganize() {
		setOrganizing(true);
		try {
			const categorized = await categorizeItems(finalizedItems, model);
			const priced = await estimatePrices(categorized, model);
			setOrganizedItems(priced);
		} finally {
			setOrganizing(false);
		}
	}

	const startNewList = useCallback(() => {
		ExpoSpeechRecognitionModule.stop();
		setSegments([]);
		setFinalized(false);
		setFinalizedItems([]);
		setOrganizedItems(null);
	}, []);

	// Without this, the post-Done screen has nowhere to "pop back" to, so the
	// hardware back button falls through to Android's default behavior and
	// exits the app entirely instead of returning to a fresh recording view.
	useEffect(() => {
		if (!finalized) return;
		const sub = BackHandler.addEventListener("hardwareBackPress", () => {
			startNewList();
			return true;
		});
		return () => sub.remove();
	}, [finalized, startNewList]);

	async function handleWhatsAppShare() {
		const text = buildShareText(finalizedItems, organizedItems);
		await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
	}

	async function handleShare() {
		const text = buildShareText(finalizedItems, organizedItems);
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

	if (finalizing) {
		return (
			<View style={[styles.container, styles.centered, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
				<StatusBar barStyle="dark-content" />
				<View style={styles.finalizingDots}>
					<LoaderDots variant="fun" />
				</View>
				<Text style={styles.finalizingText}>பட்டியலை உருவாக்குகிறேன்…</Text>
			</View>
		);
	}

	if (finalized) {
		return (
			<View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 10 }]}>
				<StatusBar barStyle="dark-content" />
				<View style={styles.header}>
					<View style={styles.headerLeft}>
						<ClipboardTextIcon weight="duotone" size={18} color={colors.accent} />
						<Text style={styles.title}>முடிந்தது! 🎉</Text>
					</View>
				</View>

				<ScrollView style={styles.itemScroll} contentContainerStyle={styles.itemScrollContent}>
					{!organizedItems && (
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
							{finalizedItems.map((item, i) => (
								<PopIn key={item.id} delay={i * 40}>
									<View style={[styles.itemRow, i < finalizedItems.length - 1 && styles.itemRowDivider]}>
										<Text style={styles.itemName}>{item.name}</Text>
										<Text style={styles.itemQty}>{item.quantity}</Text>
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
													<View style={[styles.itemRow, i < group.items.length - 1 && styles.itemRowDivider]}>
														<Text style={styles.itemName}>{item.name}</Text>
														<Text style={styles.itemQty}>
															{item.quantity}
															{item.estimatedPrice != null && ` · ₹${Math.round(item.estimatedPrice)}`}
														</Text>
													</View>
												</PopIn>
											))}
										</View>
									</View>
								</PopIn>
							);
						})
					)}
				</ScrollView>

				<View style={styles.shareActionsRow}>
					<ConfettiBurst />
					{SHARE_ACTIONS.map((action, i) => (
						<PopIn key={action.action} delay={i * 40}>
							<ShareIconButton action={action} onPress={() => handleShareAction(action.action)} />
						</PopIn>
					))}
				</View>
			</View>
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
					{hasContent && (
						<PressableScale style={styles.newListButton} onPress={startNewList}>
							<FilePlusIcon weight="regular" size={14} color={colors.text} />
							<Text style={styles.newListButtonText}>புதியது</Text>
						</PressableScale>
					)}
					<PressableScale style={styles.settingsButton} onPress={() => setHelpVisible(true)}>
						<QuestionIcon weight="regular" size={16} color={colors.textMuted} />
					</PressableScale>
					<PressableScale
						style={[styles.settingsButton, !connected && styles.settingsButtonAttention]}
						onPress={() => setSettingsVisible(true)}
					>
						<GearIcon weight="regular" size={16} color={connected ? colors.textMuted : colors.accent} />
					</PressableScale>
				</View>
			</View>

			<SettingsModal
				visible={settingsVisible}
				selectedModel={model}
				onSelect={handleSelectModel}
				onClose={() => setSettingsVisible(false)}
				connected={connected}
				connecting={connecting}
				onConnect={handleConnect}
				onDisconnect={handleDisconnect}
			/>
			<HelpModal visible={helpVisible} onClose={() => setHelpVisible(false)} />

			{segments.length === 0 ? (
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
								setFinalizedItems(lastList);
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
				<SegmentsList segments={segments} />
			)}

			{micError && <Text style={styles.error}>{micError}</Text>}

			{/* Mic is the one fixed anchor on this screen - it must never move,
			    so it's centered independently of everything else, not sharing a
			    flex row with Done (which would re-center the whole row and make
			    mic visibly jump sideways the moment Done appears). Done is a
			    separate, absolutely-positioned, secondary-weight control that
			    slots in beside it without ever touching mic's position. */}
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
	centered: {
		justifyContent: "center",
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
	finalizingDots: {
		transform: [{ scale: 2.2 }],
		marginBottom: 28,
	},
	finalizingText: {
		fontSize: 15,
		fontFamily: fontFamily.bold,
		color: colors.textMuted,
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
		alignItems: "center",
		paddingHorizontal: 12,
		paddingVertical: 10,
	},
	itemRowDivider: {
		borderBottomWidth: 1,
		borderStyle: "dashed",
		borderBottomColor: colors.borderStrong,
	},
	itemName: {
		fontSize: 14,
		fontFamily: fontFamily.medium,
		color: colors.text,
	},
	itemQty: {
		fontSize: 12,
		fontFamily: fontFamily.medium,
		color: colors.textMuted,
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
