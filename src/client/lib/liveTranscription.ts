// Uses the browser's native SpeechRecognition (Web Speech API) instead of a
// third-party STT relay. This is genuinely live (streaming interim results
// as you speak, no chunk-cutting/guessing) and taps into the same Google
// speech engine behind Android/Chrome's system voice input (and, per direct
// comparison, Google Translate's voice input) - the strongest option we've
// tried for Tamil so far. It only works reliably on Chrome (desktop and
// Android); notably it does NOT work for Tamil on iOS Safari.

export type LiveTranscriptionHandle = {
	stop: () => void;
};

export type LiveTranscriptionOptions = {
	// A phrase the recognizer has finalized - won't change on later events.
	onFinalSegment: (text: string) => void;
	// The in-progress phrase being recognized right now, replaced on each
	// event until it's finalized (never sent to the server, display-only).
	onInterimUpdate: (text: string) => void;
	onError?: (message: string) => void;
};

function getSpeechRecognitionCtor(): typeof SpeechRecognition | undefined {
	if (typeof window === "undefined") return undefined;
	return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

export function isSpeechRecognitionSupported(): boolean {
	return getSpeechRecognitionCtor() !== undefined;
}

export function startLiveTranscription(options: LiveTranscriptionOptions): LiveTranscriptionHandle {
	const SpeechRecognitionCtor = getSpeechRecognitionCtor();
	if (!SpeechRecognitionCtor) {
		throw new Error("SpeechRecognition is not supported in this browser");
	}

	let stopped = false;
	let activeRecognition: SpeechRecognition | null = null;

	const startSession = () => {
		const recognition = new SpeechRecognitionCtor();
		activeRecognition = recognition;
		recognition.lang = "ta-IN";
		recognition.continuous = true;
		recognition.interimResults = true;

		recognition.onresult = (event) => {
			let interimText = "";
			for (let i = event.resultIndex; i < event.results.length; i++) {
				const result = event.results[i];
				const text = result[0]?.transcript ?? "";
				if (result.isFinal) {
					if (text.trim()) options.onFinalSegment(text.trim());
				} else {
					interimText += text;
				}
			}
			options.onInterimUpdate(interimText);
		};

		recognition.onerror = (event) => {
			// "no-speech" and "aborted" are routine (e.g. a quiet pause, or us
			// restarting the session below) - not real errors.
			if (event.error === "no-speech" || event.error === "aborted") return;
			options.onError?.(event.error);
		};

		recognition.onend = () => {
			options.onInterimUpdate("");
			// The browser can end a session on its own (silence, internal time
			// limits) even in continuous mode. Pick straight back up so nothing
			// is missed, unless the user actually asked us to stop.
			if (!stopped) startSession();
		};

		recognition.start();
	};

	startSession();

	return {
		stop: () => {
			stopped = true;
			activeRecognition?.stop();
		},
	};
}
