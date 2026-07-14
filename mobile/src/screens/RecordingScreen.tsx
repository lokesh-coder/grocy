import { useCallback, useEffect, useState } from "react";
import { Linking, Share, StatusBar, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SolarIcon } from "react-native-solar-icons";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SegmentsList } from "../components/SegmentsList";
import { MicButton } from "../components/MicButton";
import { GradientButton } from "../components/GradientButton";
import { LoaderDots } from "../components/LoaderDots";
import { PopIn } from "../components/PopIn";
import { PressableScale } from "../components/PressableScale";
import { ConfettiBurst } from "../components/ConfettiBurst";
import { API_BASE_URL } from "../lib/config";
import { getLastListSlug, setLastListSlug } from "../lib/lastList";
import { clearSessionId, getOrCreateSessionId } from "../lib/session";
import { useSessionAgent } from "../lib/useSessionAgent";
import { colors, fontFamily, shadow } from "../theme/tokens";
import type { RootStackParamList } from "../../App";

const FINALIZING_TEXT = "பட்டியலை உருவாக்குகிறேன்…";

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

	const { clientRef, connected } = useSessionAgent(sessionId);

	useEffect(() => {
		getOrCreateSessionId().then(setSessionId);
		getLastListSlug().then(setLastListSlugState);
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

	async function startNewList() {
		setSegments([]);
		setFinalizedSlug(null);
		setSessionId(await getOrCreateSessionId());
	}

	async function handleWhatsAppShare(slug: string) {
		const url = `${API_BASE_URL}/list/${slug}`;
		await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(`மளிகை பட்டியல்: ${url}`)}`);
	}

	async function handleShare(slug: string) {
		const url = `${API_BASE_URL}/list/${slug}`;
		await Share.share({ message: `மளிகை பட்டியல்: ${url}`, url });
	}

	if (finalizedSlug) {
		return (
			<View style={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 16 }]}>
				<StatusBar barStyle="dark-content" />
				<Text style={styles.title}>முடிந்தது!</Text>
				<View style={styles.shareActionsRow}>
					<ConfettiBurst />
					<PopIn delay={0}>
						<IconButton icon="AddCircle" label="புதிய பட்டியல்" onPress={startNewList} />
					</PopIn>
					<PopIn delay={40}>
						<IconButton icon="ChatRound" label="WhatsApp" onPress={() => handleWhatsAppShare(finalizedSlug)} variant="whatsapp" size={64} />
					</PopIn>
					<PopIn delay={80}>
						<IconButton icon="Share" label="பகிரவும்" onPress={() => handleShare(finalizedSlug)} />
					</PopIn>
					<PopIn delay={120}>
						<IconButton icon="Eye" label="பட்டியல்" onPress={() => navigation.navigate("SharedList", { slug: finalizedSlug })} />
					</PopIn>
				</View>
			</View>
		);
	}

	return (
		<View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 12 }]}>
			<StatusBar barStyle="dark-content" />
			<View style={styles.header}>
				<SolarIcon name="Microphone" type="bold-duotone" size={20} color={colors.accent} />
				<Text style={styles.title}>மளிகை பட்டியல்</Text>
			</View>
			<Text style={styles.subtitle}>{connected ? "இணைக்கப்பட்டது" : "இணைக்கிறது…"}</Text>

			<SegmentsList segments={segments} />

			{segments.length === 0 && lastListSlug && (
				<PressableScale style={styles.lastListLink} onPress={() => navigation.navigate("SharedList", { slug: lastListSlug })}>
					<SolarIcon name="ClockCircle" type="linear" size={14} color={colors.textMuted} />
					<Text style={styles.lastListLinkText}>கடைசி பட்டியலைப் பார்</Text>
				</PressableScale>
			)}

			{micError && <Text style={styles.error}>{micError}</Text>}

			<View style={styles.controls}>
				<MicButton recording={listening} onPress={toggleListening} />
			</View>

			{segments.length > 0 && (
				<GradientButton onPress={handleDone} disabled={finalizing}>
					{finalizing ? (
						<>
							<LoaderDots variant="onAccent" />
							<Text style={styles.doneButtonText}>{FINALIZING_TEXT}</Text>
						</>
					) : (
						<>
							<SolarIcon name="CheckCircle" type="bold" size={18} color={colors.onAccent} />
							<Text style={styles.doneButtonText}>முடிந்தது</Text>
						</>
					)}
				</GradientButton>
			)}
		</View>
	);
}

function IconButton({
	icon,
	label,
	onPress,
	variant,
	size = 52,
}: {
	icon: string;
	label: string;
	onPress: () => void;
	variant?: "whatsapp";
	size?: number;
}) {
	const isWhatsapp = variant === "whatsapp";
	return (
		<PressableScale
			onPress={onPress}
			accessibilityLabel={label}
			style={[
				styles.iconButton,
				{ width: size, height: size, borderRadius: size / 2 },
				isWhatsapp ? styles.iconButtonWhatsapp : styles.iconButtonNeutral,
			]}
		>
			<SolarIcon name={icon} type={isWhatsapp ? "bold" : "linear"} size={isWhatsapp ? 28 : 22} color={isWhatsapp ? "#062013" : colors.text} />
		</PressableScale>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.bg,
		paddingHorizontal: 20,
		alignItems: "center",
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	title: {
		fontSize: 20,
		fontFamily: fontFamily.extrabold,
		color: colors.text,
	},
	subtitle: {
		fontSize: 13,
		fontFamily: fontFamily.semibold,
		color: colors.textMuted,
		marginTop: 4,
		marginBottom: 24,
	},
	error: {
		color: colors.danger,
		fontFamily: fontFamily.medium,
		marginTop: 12,
		textAlign: "center",
	},
	lastListLink: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		marginTop: 12,
		alignSelf: "center",
	},
	lastListLinkText: {
		color: colors.textMuted,
		fontFamily: fontFamily.semibold,
		fontSize: 13,
	},
	controls: {
		alignItems: "center",
		paddingVertical: 12,
	},
	doneButtonText: {
		color: colors.onAccent,
		fontFamily: fontFamily.bold,
		fontSize: 15,
	},
	shareActionsRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 18,
		marginTop: 24,
		position: "relative",
	},
	iconButton: {
		alignItems: "center",
		justifyContent: "center",
		...shadow.sm,
	},
	iconButtonNeutral: {
		backgroundColor: colors.surface,
		borderWidth: 1.5,
		borderColor: colors.borderStrong,
	},
	iconButtonWhatsapp: {
		backgroundColor: colors.whatsapp,
		...shadow.md,
	},
});
