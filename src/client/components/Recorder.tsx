import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Microphone, Stop } from "@phosphor-icons/react";
import {
	isSpeechRecognitionSupported,
	startLiveTranscription,
	type LiveTranscriptionHandle,
} from "../lib/liveTranscription";
import type { SessionState } from "../../shared/types";

type Props = {
	transcript: string;
	status: SessionState["status"];
	onSegment: (text: string) => void;
	onRecordingChange?: (isRecording: boolean) => void;
};

export type RecorderHandle = {
	stop: () => void;
};

export const Recorder = forwardRef<RecorderHandle, Props>(function Recorder(
	{ transcript, status, onSegment, onRecordingChange },
	ref,
) {
	const [isRecording, setIsRecording] = useState(false);

	useEffect(() => {
		onRecordingChange?.(isRecording);
	}, [isRecording, onRecordingChange]);
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
				onFinalSegment: onSegment,
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

	// Lets App stop the mic before finalizing, in case Done is clicked without pressing stop first.
	useImperativeHandle(ref, () => ({ stop }), [stop]);

	// Stays visible even after the mic visually stops, since the server may
	// still be extracting the last thing you said - reverting to "press mic
	// to start" immediately made that work look like it never happened until
	// something else (like clicking Done) nudged it along.
	const showBusy = isRecording || status === "extracting";

	return (
		<div className="record-bar">
			<button
				className={`mic-button ${isRecording ? "recording" : ""}`}
				onClick={isRecording ? stop : start}
				aria-label={isRecording ? "பதிவை நிறுத்து" : "பதிவைத் தொடங்கு"}
			>
				{isRecording ? <Stop weight="fill" size={22} /> : <Microphone weight="duotone" size={26} />}
			</button>

			<div className="record-info">
				<p className={`status-line ${showBusy ? "is-live" : ""}`}>
					{isRecording && (
						<span className="wave" aria-hidden="true">
							<span className="wave-bar" />
							<span className="wave-bar" />
							<span className="wave-bar" />
							<span className="wave-bar" />
						</span>
					)}
					{status === "extracting" ? (
						<span className="loader-dots" aria-hidden="true">
							<span className="loader-dot" />
							<span className="loader-dot" />
							<span className="loader-dot" />
						</span>
					) : (
						showBusy && <span className="status-dot" />
					)}
					{statusText(isRecording, status)}
				</p>

				{error ? (
					<p className="error-line">{error}</p>
				) : (
					<p className="live-transcript">
						{!transcript && !interimText && <span className="placeholder-text">பேசத் தொடங்குங்கள்…</span>}
						{tailText(transcript)}
						{transcript && interimText ? " " : ""}
						<span className="interim-text">{interimText}</span>
						{isRecording && <span className="live-cursor" />}
					</p>
				)}
			</div>
		</div>
	);
});

function statusText(isRecording: boolean, status: SessionState["status"]): string {
	if (status === "extracting") return "பட்டியலை புதுப்பிக்கிறேன்…";
	if (!isRecording) return "தொடங்க மைக்கை அழுத்தவும்";
	return "கேட்கிறேன்…";
}

// This is a compact "what you just said" line, not a transcript archive - the
// grocery list below is the real content. A long session's transcript can run
// to thousands of characters, and CSS line-clamp truncation cuts off the END
// (hiding the newest words, keeping stale ones), which is backwards for a
// live caption. Trimming to the tail in JS keeps the most recent speech
// visible no matter how long the session runs.
const MAX_TRANSCRIPT_TAIL = 140;

function tailText(text: string): string {
	if (text.length <= MAX_TRANSCRIPT_TAIL) return text;
	return `…${text.slice(-MAX_TRANSCRIPT_TAIL)}`;
}
