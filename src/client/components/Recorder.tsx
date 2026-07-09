import { useCallback, useRef, useState } from "react";
import { startChunkedRecording, type ChunkerHandle } from "../lib/chunker";
import type { SessionState } from "../../shared/types";

type Props = {
	transcript: string;
	status: SessionState["status"];
	onChunk: (audioBase64: string) => Promise<void>;
};

export function Recorder({ transcript, status, onChunk }: Props) {
	const [isRecording, setIsRecording] = useState(false);
	const [level, setLevel] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const handleRef = useRef<ChunkerHandle | null>(null);

	const start = useCallback(async () => {
		setError(null);
		try {
			const handle = await startChunkedRecording({
				onChunk,
				onLevel: setLevel,
				onError: (err) => {
					console.error(err);
					setError("பதிவு செய்வதில் சிக்கல் ஏற்பட்டது. மீண்டும் முயற்சிக்கவும்.");
					setIsRecording(false);
				},
			});
			handleRef.current = handle;
			setIsRecording(true);
		} catch (err) {
			console.error(err);
			setError("மைக்ரோஃபோன் அணுக முடியவில்லை.");
		}
	}, [onChunk]);

	const stop = useCallback(() => {
		handleRef.current?.stop();
		handleRef.current = null;
		setIsRecording(false);
		setLevel(0);
	}, []);

	return (
		<div className="pane recorder-pane">
			<h2>பேசுங்கள்</h2>

			<button
				className={`mic-button ${isRecording ? "recording" : ""}`}
				style={{ transform: isRecording ? `scale(${1 + Math.min(level, 1) * 0.3})` : undefined }}
				onClick={isRecording ? stop : start}
			>
				{isRecording ? "⏹" : "🎙"}
			</button>

			<p className="status-line">
				{isRecording
					? status === "processing"
						? "கேட்கிறேன்… (எழுதிக்கொண்டிருக்கிறேன்)"
						: "கேட்கிறேன்…"
					: "தொடங்க மைக்கை அழுத்தவும்"}
			</p>

			{error && <p className="error-line">{error}</p>}

			<div className="transcript-box">
				<h3>பேச்சு உரை</h3>
				<p>{transcript || "…"}</p>
			</div>
		</div>
	);
}
