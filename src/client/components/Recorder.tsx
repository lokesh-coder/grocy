import { useCallback, useRef, useState } from "react";
import { startSarvamCapture, type SarvamCaptureHandle } from "../lib/sarvamCapture";
import type { SessionState } from "../../shared/types";

type Props = {
	transcript: string;
	status: SessionState["status"];
	onAudioChunk: (base64Pcm: string) => void;
	onFlush: () => void;
	onStop: () => void;
};

export function Recorder({ transcript, status, onAudioChunk, onFlush, onStop }: Props) {
	const [isRecording, setIsRecording] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const handleRef = useRef<SarvamCaptureHandle | null>(null);

	const start = useCallback(async () => {
		setError(null);
		try {
			const handle = await startSarvamCapture({
				onAudioChunk,
				onFlush,
				onError: (err) => {
					console.error("audio capture error:", err);
					setError("பதிவு செய்வதில் சிக்கல் ஏற்பட்டது.");
					setIsRecording(false);
				},
			});
			handleRef.current = handle;
			setIsRecording(true);
		} catch (err) {
			console.error(err);
			setError("மைக்ரோஃபோன் அணுக முடியவில்லை.");
		}
	}, [onAudioChunk, onFlush]);

	const stop = useCallback(() => {
		handleRef.current?.stop();
		handleRef.current = null;
		setIsRecording(false);
		onStop();
	}, [onStop]);

	return (
		<div className="pane recorder-pane">
			<h2>
				<span className="heading-icon">🎙️</span>பேசுங்கள்
			</h2>

			<button className={`mic-button ${isRecording ? "recording" : ""}`} onClick={isRecording ? stop : start}>
				{isRecording ? "⏹" : "🎙"}
			</button>

			<p className={`status-line ${isRecording ? "is-live" : ""}`}>
				{isRecording && <span className={`status-dot ${status === "extracting" ? "busy" : ""}`} />}
				{statusText(isRecording, status)}
			</p>

			{error && <p className="error-line">{error}</p>}

			<div className="transcript-box">
				<h3>பேச்சு உரை</h3>
				<p>
					{transcript}
					{!transcript && <span className="placeholder-text">பேசத் தொடங்குங்கள்…</span>}
					{isRecording && <span className="live-cursor" />}
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
