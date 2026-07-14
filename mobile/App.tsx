import { useState } from "react";
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { useAgent } from "agents/react";
import { AccessAwareWebSocket, API_HOST } from "./src/lib/config";
import type { SessionState } from "./src/shared/types";

// Phase 0 smoke test only - proves the agents SDK's WebSocket client can
// reach the ListSessionAgent Durable Object through Cloudflare Access from
// RN. Replaced by the real RecordingScreen in Phase 1. A fixed session name
// (not persisted/rotated) is fine here since this is throwaway.
const SMOKE_TEST_SESSION = "mobile-phase0-smoke-test";

function ConnectionSmokeTest() {
  const agent = useAgent<SessionState>({
    agent: "ListSessionAgent",
    name: SMOKE_TEST_SESSION,
    host: API_HOST,
    // Injects Access auth headers onto the WS upgrade - see config.ts.
    WebSocket: AccessAwareWebSocket,
  });

  return (
    <View style={smokeStyles.box}>
      <Text style={smokeStyles.label}>WS status: {agent.readyState === WebSocket.OPEN ? "connected" : "connecting…"}</Text>
      <Text style={smokeStyles.label}>transcript: {agent.state?.transcript || "(empty)"}</Text>
      <Pressable
        style={smokeStyles.button}
        onPress={() => agent.stub.addTranscriptSegment(`smoke test ${new Date().toLocaleTimeString()}`)}
      >
        <Text style={smokeStyles.buttonText}>Send test segment</Text>
      </Pressable>
    </View>
  );
}

const smokeStyles = StyleSheet.create({
  box: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 6,
  },
  label: { fontSize: 13, color: "#444" },
  button: { backgroundColor: "#111", borderRadius: 8, paddingVertical: 8, alignItems: "center", marginTop: 4 },
  buttonText: { color: "#fff", fontWeight: "600" },
});

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

      <ConnectionSmokeTest />

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
