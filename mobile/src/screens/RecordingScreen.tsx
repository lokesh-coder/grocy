import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, Share, StatusBar, StyleSheet, Text, View } from "react-native";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SegmentsList } from "../components/SegmentsList";
import { API_BASE_URL } from "../lib/config";
import { getLastListSlug, setLastListSlug } from "../lib/lastList";
import { clearSessionId, getOrCreateSessionId } from "../lib/session";
import { useSessionAgent } from "../lib/useSessionAgent";
import type { RootStackParamList } from "../../App";

const FINALIZING_TEXT = "பட்டியலை உருவாக்குகிறேன்…";

export function RecordingScreen() {
	const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, "Recording">>();
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
			<View style={styles.container}>
				<StatusBar barStyle="dark-content" />
				<Text style={styles.title}>முடிந்தது!</Text>
				<View style={styles.shareActions}>
					<Pressable style={styles.shareButton} onPress={startNewList}>
						<Text style={styles.shareButtonText}>புதிய பட்டியல்</Text>
					</Pressable>
					<Pressable style={[styles.shareButton, styles.whatsappButton]} onPress={() => handleWhatsAppShare(finalizedSlug)}>
						<Text style={styles.shareButtonText}>WhatsApp-இல் பகிரவும்</Text>
					</Pressable>
					<Pressable style={styles.shareButton} onPress={() => handleShare(finalizedSlug)}>
						<Text style={styles.shareButtonText}>பகிரவும்</Text>
					</Pressable>
					<Pressable style={styles.shareButton} onPress={() => navigation.navigate("SharedList", { slug: finalizedSlug })}>
						<Text style={styles.shareButtonText}>பட்டியலைப் பார்</Text>
					</Pressable>
				</View>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<StatusBar barStyle="dark-content" />
			<Text style={styles.title}>மளிகை பட்டியல்</Text>
			<Text style={styles.subtitle}>{connected ? "இணைக்கப்பட்டது" : "இணைக்கிறது…"}</Text>

			<SegmentsList segments={segments} />

			{segments.length === 0 && lastListSlug && (
				<Pressable onPress={() => navigation.navigate("SharedList", { slug: lastListSlug })}>
					<Text style={styles.lastListLink}>கடைசி பட்டியலைப் பார்</Text>
				</Pressable>
			)}

			{micError && <Text style={styles.error}>{micError}</Text>}

			<View style={styles.controls}>
				<Pressable style={[styles.micButton, listening && styles.micButtonActive]} onPress={toggleListening}>
					<Text style={styles.micButtonText}>{listening ? "நிறுத்து" : "பேசு"}</Text>
				</Pressable>
			</View>

			{segments.length > 0 && (
				<Pressable style={[styles.doneButton, finalizing && styles.doneButtonDisabled]} disabled={finalizing} onPress={handleDone}>
					<Text style={styles.doneButtonText}>{finalizing ? FINALIZING_TEXT : "முடிந்தது"}</Text>
				</Pressable>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#fff",
		paddingTop: 60,
		paddingHorizontal: 20,
		alignItems: "center",
	},
	title: {
		fontSize: 20,
		fontWeight: "700",
	},
	subtitle: {
		fontSize: 13,
		color: "#888",
		marginTop: 4,
		marginBottom: 24,
	},
	error: {
		color: "#c0392b",
		marginTop: 12,
		textAlign: "center",
	},
	lastListLink: {
		color: "#2563eb",
		marginTop: 12,
	},
	controls: {
		alignItems: "center",
		paddingVertical: 24,
	},
	micButton: {
		width: 88,
		height: 88,
		borderRadius: 44,
		backgroundColor: "#2563eb",
		alignItems: "center",
		justifyContent: "center",
	},
	micButtonActive: {
		backgroundColor: "#dc2626",
	},
	micButtonText: {
		color: "#fff",
		fontWeight: "700",
		fontSize: 15,
	},
	doneButton: {
		width: "100%",
		backgroundColor: "#111",
		borderRadius: 10,
		paddingVertical: 14,
		alignItems: "center",
		marginBottom: 24,
	},
	doneButtonDisabled: {
		opacity: 0.6,
	},
	doneButtonText: {
		color: "#fff",
		fontWeight: "700",
		fontSize: 15,
	},
	shareActions: {
		width: "100%",
		gap: 12,
		marginTop: 24,
	},
	shareButton: {
		backgroundColor: "#111",
		borderRadius: 10,
		paddingVertical: 14,
		alignItems: "center",
	},
	whatsappButton: {
		backgroundColor: "#25d366",
	},
	shareButtonText: {
		color: "#fff",
		fontWeight: "700",
		fontSize: 15,
	},
});
