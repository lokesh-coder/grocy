import { useCallback, useRef, useState } from "react";
import { startSarvamCapture, type SarvamCaptureHandle } from "../lib/sarvamCapture";
import type { SessionState } from "../../shared/types";

type Props = {
	transcript: string;
	status: SessionState["status"];
	onAudioChunk: (base64Pcm: string) => void;
	onStop: () => void;
};

export function Recorder({ transcript, status, onAudioChunk, onStop }: Props) {
	const [isRecording, setIsRecording] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const handleRef = useRef<SarvamCaptureHandle | null>(null);

	const start = useCallback(async () => {
		setError(null);
		try {
			const handle = await startSarvamCapture({
				onAudioChunk,
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
	}, [onAudioChunk]);

	const stop = useCallback(() => {
		handleRef.current?.stop();
		handleRef.current = null;
		setIsRecording(false);
		onStop();
	}, [onStop]);

	// Stays visible even after the mic visually stops, since the server may
	// still be flushing/extracting the last thing you said - reverting to
	// "press mic to start" immediately made that work look like it never
	// happened until something else (like clicking Done) nudged it along.
	const showBusy = isRecording || status === "extracting";

	return (
		<div className="pane recorder-pane">
			<h2>
				<span className="heading-icon">🎙️</span>பேசுங்கள்
			</h2>

			<button className={`mic-button ${isRecording ? "recording" : ""}`} onClick={isRecording ? stop : start}>
				{isRecording ? "⏹" : "🎙"}
			</button>

			<p className={`status-line ${showBusy ? "is-live" : ""}`}>
				{showBusy && <span className={`status-dot ${status === "extracting" ? "busy" : ""}`} />}
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
	if (status === "extracting") return "பட்டியலை புதுப்பிக்கிறேன்…";
	if (!isRecording) return "தொடங்க மைக்கை அழுத்தவும்";
	return "கேட்கிறேன்…";
}
