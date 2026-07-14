import { useState } from "react";
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";

// Spike: only exists to compare native Android speech recognition quality
// against the current PWA's browser SpeechRecognition, side by side on the
// same phone. Not wired to the real app/backend yet.
export default function App() {
  const [listening, setListening] = useState(false);
  const [segments, setSegments] = useState<string[]>([]);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  useSpeechRecognitionEvent("start", () => setListening(true));
  useSpeechRecognitionEvent("end", () => setListening(false));

  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results[0]?.transcript ?? "";
    if (event.isFinal) {
      if (transcript.trim()) setSegments((prev) => [...prev, transcript.trim()]);
      setInterim("");
    } else {
      setInterim(transcript);
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    setError(`${event.error}: ${event.message}`);
    setListening(false);
  });

  async function toggleListening() {
    if (listening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    setError(null);
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setError("Microphone permission denied");
      return;
    }
    ExpoSpeechRecognitionModule.start({
      lang: "ta-IN",
      continuous: true,
      interimResults: true,
    });
  }

  function clear() {
    setSegments([]);
    setInterim("");
    setError(null);
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <Text style={styles.title}>Speech Recognition Spike</Text>
      <Text style={styles.subtitle}>Native Android · ta-IN · continuous</Text>

      <ScrollView style={styles.transcriptBox} contentContainerStyle={styles.transcriptContent}>
        {segments.length === 0 && !interim && <Text style={styles.placeholder}>Segments will appear here…</Text>}
        {segments.map((segment, i) => (
          <Text key={i} style={styles.segment}>
            {segment}
          </Text>
        ))}
        {interim ? <Text style={styles.interim}>{interim}</Text> : null}
      </ScrollView>

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.controls}>
        <Pressable style={styles.clearButton} onPress={clear}>
          <Text style={styles.clearButtonText}>Clear</Text>
        </Pressable>
        <Pressable
          style={[styles.micButton, listening && styles.micButtonActive]}
          onPress={toggleListening}
        >
          <Text style={styles.micButtonText}>{listening ? "Stop" : "Speak"}</Text>
        </Pressable>
        <View style={styles.clearButton} />
      </View>
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
  transcriptBox: {
    flex: 1,
    width: "100%",
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 12,
    padding: 16,
  },
  transcriptContent: {
    gap: 10,
  },
  placeholder: {
    color: "#bbb",
    fontSize: 15,
  },
  segment: {
    fontSize: 18,
    color: "#111",
  },
  interim: {
    fontSize: 18,
    color: "#999",
    fontStyle: "italic",
  },
  error: {
    color: "#c0392b",
    marginTop: 12,
    textAlign: "center",
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingVertical: 24,
  },
  clearButton: {
    width: 64,
    alignItems: "center",
  },
  clearButtonText: {
    color: "#888",
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
});
