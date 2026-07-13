import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Microphone, Stop } from "@phosphor-icons/react";
import { isSpeechRecognitionSupported, startLiveTranscription, type LiveTranscriptionHandle } from "../lib/liveTranscription";

type Props = {
	onSegment: (text: string) => void;
};

export type RecorderHandle = {
	stop: () => void;
};

// The teleprompter feed above (and the Done button's own loading state)
// already show what's being said and when something's processing, so this
// bar doesn't need to duplicate any of that - just the control itself, made
// as prominent as possible since it's the one thing you interact with here.
export const Recorder = forwardRef<RecorderHandle, Props>(function Recorder({ onSegment }, ref) {
	const [isRecording, setIsRecording] = useState(false);
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
				onInterimUpdate: () => {},
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
	}, []);

	// Lets App stop the mic before finalizing, in case Done is clicked without pressing stop first.
	useImperativeHandle(ref, () => ({ stop }), [stop]);

	return (
		<div className="record-bar">
			<button
				className={`mic-button ${isRecording ? "recording" : ""}`}
				onClick={isRecording ? stop : start}
				aria-label={isRecording ? "பதிவை நிறுத்து" : "பதிவைத் தொடங்கு"}
			>
				{isRecording ? <Stop weight="fill" size={30} /> : <Microphone weight="duotone" size={34} />}
			</button>
			{error && <p className="error-line">{error}</p>}
		</div>
	);
});
