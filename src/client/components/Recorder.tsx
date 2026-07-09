import { useCallback, useMemo, useRef, useState } from "react";
import {
	isSpeechRecognitionSupported,
	startLiveTranscription,
	type LiveTranscriptionHandle,
} from "../lib/liveTranscription";
import type { SessionState } from "../../shared/types";

type Props = {
	transcript: string;
	status: SessionState["status"];
	onSegment: (text: string) => Promise<void>;
};

export function Recorder({ transcript, status, onSegment }: Props) {
	const [isRecording, setIsRecording] = useState(false);
	const [interimText, setInterimText] = useState("");
	const [error, setError] = useState<string | null>(null);
	const handleRef = useRef<LiveTranscriptionHandle | null>(null);
	const supported = useMemo(() => isSpeechRecognitionSupported(), []);

	const start = useCallback(() => {
		setError(null);
		if (!supported) {
			setError("இந்த உலாவியில் குரல் அங்கீகாரம் ஆதரிக்கப்படவில்லை. Android-இல் Chrome பயன்படுத்தவும்.");
			return;
		}
		try {
			const handle = startLiveTranscription({
				onFinalSegment: (text) => {
					void onSegment(text);
				},
				onInterimUpdate: setInterimText,
				onError: (message) => {
					console.error("speech recognition error:", message);
					if (message === "not-allowed") {
						setError("மைக்ரோஃபோன் அனுமதி மறுக்கப்பட்டது.");
						setIsRecording(false);
					}
					// other errors (e.g. transient network hiccups) are recovered
					// from automatically by the auto-restart in liveTranscription.
				},
			});
			handleRef.current = handle;
			setIsRecording(true);
		} catch (err) {
			console.error(err);
			setError("மைக்ரோஃபோனைத் தொடங்க முடியவில்லை.");
		}
	}, [onSegment, supported]);

	const stop = useCallback(() => {
		handleRef.current?.stop();
		handleRef.current = null;
		setIsRecording(false);
		setInterimText("");
	}, []);

	return (
		<div className="pane recorder-pane">
			<h2>பேசுங்கள்</h2>

			<button className={`mic-button ${isRecording ? "recording" : ""}`} onClick={isRecording ? stop : start}>
				{isRecording ? "⏹" : "🎙"}
			</button>

			<p className="status-line">{statusText(isRecording, status)}</p>

			{error && <p className="error-line">{error}</p>}

			<div className="transcript-box">
				<h3>பேச்சு உரை</h3>
				<p>
					{transcript}
					{transcript && interimText ? " " : ""}
					<span className="interim-text">{interimText}</span>
					{!transcript && !interimText && "…"}
				</p>
			</div>
		</div>
	);
}

function statusText(isRecording: boolean, status: SessionState["status"]): string {
	if (!isRecording) return "தொடங்க மைக்கை அழுத்தவும்";
	if (status === "extracting") return "பட்டியலை புதுப்பிக்கிறேன்…";
	return "கேட்கிறேன்…";
}
