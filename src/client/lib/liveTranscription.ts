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
	// Tracks what the recognizer last emitted as final, across restarts (not
	// reset in startSession) - Android's continuous mode restarts far more
	// often than desktop Chrome's, and each restart can re-capture the tail
	// of what the previous session already heard. Comparing against this
	// catches that overlap before it reaches the transcript.
	let lastFinalText = "";

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
					const deduped = stripOverlap(lastFinalText, text.trim());
					lastFinalText = text.trim();
					if (deduped) options.onFinalSegment(deduped);
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

// If the tail of `previous` matches the head of `next` word-for-word, that
// overlap is almost certainly a restart re-capturing audio the last session
// already transcribed, not a person genuinely repeating a whole phrase back
// to back - strip it. Only exact word matches are trimmed, capped at a
// small window, so it can't misfire on legitimate repeated words.
const MAX_OVERLAP_WORDS = 6;

function stripOverlap(previous: string, next: string): string {
	if (!previous || !next) return next;

	const prevWords = previous.split(/\s+/);
	const nextWords = next.split(/\s+/);
	const maxOverlap = Math.min(prevWords.length, nextWords.length, MAX_OVERLAP_WORDS);

	for (let overlap = maxOverlap; overlap > 0; overlap--) {
		const prevTail = prevWords.slice(-overlap).join(" ");
		const nextHead = nextWords.slice(0, overlap).join(" ");
		if (prevTail === nextHead) {
			return nextWords.slice(overlap).join(" ").trim();
		}
	}

	return next;
}
