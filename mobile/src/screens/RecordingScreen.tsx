import { useCallback, useEffect, useState } from "react";
import { Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { SegmentsList } from "../components/SegmentsList";
import { getOrCreateSessionId } from "../lib/session";
import { useSessionAgent } from "../lib/useSessionAgent";

const FINALIZING_TEXT = "பட்டியலை உருவாக்குகிறேன்…";

export function RecordingScreen() {
	const [sessionId, setSessionId] = useState<string | null>(null);
	const [segments, setSegments] = useState<string[]>([]);
	const [listening, setListening] = useState(false);
	const [micError, setMicError] = useState<string | null>(null);
	const [finalizing, setFinalizing] = useState(false);
	const [finalizedSlug, setFinalizedSlug] = useState<string | null>(null);

	const { clientRef, connected } = useSessionAgent(sessionId);

	useEffect(() => {
		getOrCreateSessionId().then(setSessionId);
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
			if (result?.slug) setFinalizedSlug(result.slug);
		} finally {
			setFinalizing(false);
		}
	}

	if (finalizedSlug) {
		return (
			<View style={styles.container}>
				<StatusBar barStyle="dark-content" />
				<Text style={styles.title}>முடிந்தது!</Text>
				<Text style={styles.subtitle}>slug: {finalizedSlug}</Text>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<StatusBar barStyle="dark-content" />
			<Text style={styles.title}>மளிகை பட்டியல்</Text>
			<Text style={styles.subtitle}>{connected ? "இணைக்கப்பட்டது" : "இணைக்கிறது…"}</Text>

			<SegmentsList segments={segments} />

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
});
