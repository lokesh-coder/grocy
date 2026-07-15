import { useCallback, useEffect, useState } from "react";
import { BackHandler, Linking, ScrollView, Share, StatusBar, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
	BasketIcon,
	ClipboardTextIcon,
	ClockIcon,
	EyeIcon,
	FilePlusIcon,
	SealCheckIcon,
	ShareNetworkIcon,
	ShoppingBagIcon,
	WhatsappLogoIcon,
	type Icon,
} from "phosphor-react-native";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SegmentsList } from "../components/SegmentsList";
import { MicButton } from "../components/MicButton";
import { LoaderDots } from "../components/LoaderDots";
import { PopIn } from "../components/PopIn";
import { PressableScale } from "../components/PressableScale";
import { ConfettiBurst } from "../components/ConfettiBurst";
import { LINK_BASE_URL } from "../lib/config";
import { getFrequentItems } from "../lib/api";
import { getLastListSlug, setLastListSlug } from "../lib/lastList";
import { clearSessionId, getOrCreateSessionId } from "../lib/session";
import { useSessionAgent } from "../lib/useSessionAgent";
import { colors, fontFamily, radius } from "../theme/tokens";
import type { RootStackParamList } from "../../App";

type FrequentItem = { name: string; quantity: string };

// Uniform treatment for all four - no WhatsApp size/color emphasis, no
// per-icon color tinting. Reading as one cohesive row of equal-weight
// actions is the point (see the design-system discussion in this commit).
// Fun comes from each icon's own duotone color pair, not from varying the
// button shape/size/background - that keeps the row visually consistent
// while still giving each action its own identity.
type ShareAction = "new" | "whatsapp" | "share" | "view";
const SHARE_ACTIONS: Array<{ action: ShareAction; Icon: Icon; label: string; color: string }> = [
	{ action: "new", Icon: FilePlusIcon, label: "புதிய பட்டியல்", color: colors.fun.sage },
	{ action: "whatsapp", Icon: WhatsappLogoIcon, label: "WhatsApp", color: colors.fun.blue },
	{ action: "share", Icon: ShareNetworkIcon, label: "பகிரவும்", color: colors.fun.berry },
	{ action: "view", Icon: EyeIcon, label: "பட்டியல்", color: colors.fun.gold },
];

export function RecordingScreen() {
	const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, "Recording">>();
	const insets = useSafeAreaInsets();
	const [sessionId, setSessionId] = useState<string | null>(null);
	const [segments, setSegments] = useState<string[]>([]);
	const [listening, setListening] = useState(false);
	const [micError, setMicError] = useState<string | null>(null);
	const [finalizing, setFinalizing] = useState(false);
	const [finalizedSlug, setFinalizedSlug] = useState<string | null>(null);
	const [lastListSlug, setLastListSlugState] = useState<string | null>(null);
	const [frequentItems, setFrequentItems] = useState<FrequentItem[]>([]);

	const { clientRef, connected, state } = useSessionAgent(sessionId);
	const hasContent = segments.length > 0 || !!finalizedSlug;

	useEffect(() => {
		getOrCreateSessionId().then(setSessionId);
		getLastListSlug().then(setLastListSlugState);
		getFrequentItems()
			.then((data) => setFrequentItems(data.items))
			.catch(() => {
				// not critical - the empty state just won't show quick-add chips
			});
	}, []);

	const addSegment = useCallback(
		(text: string) => {
			setSegments((prev) => [...prev, text]);
			clientRef.current?.stub.addTranscriptSegment(text);
		},
		[clientRef],
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

	async function handleDone() {
		if (listening) ExpoSpeechRecognitionModule.stop();
		setFinalizing(true);
		try {
			const result = await clientRef.current?.stub.finalize();
			if (result?.slug) {
				await clearSessionId();
				await setLastListSlug(result.slug);
				setLastListSlugState(result.slug);
				setFinalizedSlug(result.slug);
			}
		} finally {
			setFinalizing(false);
		}
	}

	const startNewList = useCallback(async () => {
		// Always clear first - if this is called mid-recording (tapping "New
		// list" in the header rather than after Done, which already clears),
		// getOrCreateSessionId() would otherwise just hand back the same
		// still-stored session id instead of starting a genuinely new one.
		ExpoSpeechRecognitionModule.stop();
		await clearSessionId();
		setSegments([]);
		setFinalizedSlug(null);
		setSessionId(await getOrCreateSessionId());
	}, []);

	// Without this, the post-Done screen has nowhere to "pop back" to in the
	// nav stack (it's still the Recording route, just a different local
	// state), so the hardware back button falls through to Android's default
	// behavior and exits the app entirely instead of returning to a fresh
	// recording view.
	useEffect(() => {
		if (!finalizedSlug) return;
		const sub = BackHandler.addEventListener("hardwareBackPress", () => {
			startNewList();
			return true;
		});
		return () => sub.remove();
	}, [finalizedSlug, startNewList]);

	async function handleWhatsAppShare(slug: string) {
		const url = `${LINK_BASE_URL}/list/${slug}`;
		await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(`மளிகை பட்டியல்: ${url}`)}`);
	}

	async function handleShare(slug: string) {
		const url = `${LINK_BASE_URL}/list/${slug}`;
		await Share.share({ message: `மளிகை பட்டியல்: ${url}`, url });
	}

	function handleShareAction(action: ShareAction, slug: string) {
		if (action === "new") startNewList();
		else if (action === "whatsapp") handleWhatsAppShare(slug);
		else if (action === "share") handleShare(slug);
		else if (action === "view") navigation.navigate("SharedList", { slug });
	}

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

	if (finalizedSlug) {
		const items = state?.items ?? [];
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
					<View style={styles.itemListCard}>
						{items.map((item, i) => (
							<PopIn key={item.id} delay={i * 40}>
								<View style={[styles.itemRow, i < items.length - 1 && styles.itemRowDivider]}>
									<Text style={styles.itemName}>{item.name}</Text>
									<Text style={styles.itemQty}>{item.quantity}</Text>
								</View>
							</PopIn>
						))}
					</View>
				</ScrollView>

				<View style={styles.shareActionsRow}>
					<ConfettiBurst />
					{SHARE_ACTIONS.map((action, i) => (
						<PopIn key={action.action} delay={i * 40}>
							<ShareIconButton action={action} onPress={() => handleShareAction(action.action, finalizedSlug)} />
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
					<View style={[styles.statusDot, connected && styles.statusDotConnected]} />
				</View>
				{hasContent && (
					<PressableScale style={styles.newListButton} onPress={startNewList}>
						<FilePlusIcon weight="regular" size={14} color={colors.text} />
						<Text style={styles.newListButtonText}>புதியது</Text>
					</PressableScale>
				)}
			</View>

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
					{lastListSlug && (
						<PressableScale style={styles.lastListLink} onPress={() => navigation.navigate("SharedList", { slug: lastListSlug })}>
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

// Same rounded-square shape/size for all four (consistency), but a
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
	title: {
		fontSize: 16,
		fontFamily: fontFamily.extrabold,
		color: colors.text,
	},
	statusDot: {
		width: 6,
		height: 6,
		borderRadius: 3,
		backgroundColor: colors.borderStrong,
		marginLeft: 2,
	},
	statusDotConnected: {
		backgroundColor: colors.fun.sage,
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
