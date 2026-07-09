// Splits a live microphone stream into short chunks on natural pauses in speech,
// so Whisper (which only accepts full audio clips, not a live stream) can be called
// repeatedly to produce a transcript that feels like it's arriving in real time.

const SILENCE_RMS_THRESHOLD = 0.02;
const SILENCE_HOLD_MS = 900;
const MAX_CHUNK_MS = 8000;
const MIN_CHUNK_MS = 1200;
const POLL_INTERVAL_MS = 100;

export type ChunkerHandle = {
	stop: () => void;
};

export type ChunkerOptions = {
	// Called once per chunk. The recorder waits for this to resolve before
	// capturing the next chunk, so chunks are always processed in order.
	onChunk: (audioBase64: string) => Promise<void> | void;
	onError?: (error: unknown) => void;
	onLevel?: (rms: number) => void;
};

function pickMimeType(): string | undefined {
	const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
	for (const type of candidates) {
		if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
			return type;
		}
	}
	return undefined;
}

function blobToBase64(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onloadend = () => {
			const result = reader.result as string;
			resolve(result.slice(result.indexOf(",") + 1));
		};
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(blob);
	});
}

export async function startChunkedRecording(options: ChunkerOptions): Promise<ChunkerHandle> {
	const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
	const mimeType = pickMimeType();

	const audioContext = new AudioContext();
	const source = audioContext.createMediaStreamSource(stream);
	const analyser = audioContext.createAnalyser();
	analyser.fftSize = 1024;
	source.connect(analyser);
	const levelData = new Uint8Array(analyser.fftSize);

	let stopped = false;
	let activeRecorder: MediaRecorder | null = null;

	function currentRms(): number {
		analyser.getByteTimeDomainData(levelData);
		let sumSquares = 0;
		for (let i = 0; i < levelData.length; i++) {
			const centered = (levelData[i] - 128) / 128;
			sumSquares += centered * centered;
		}
		return Math.sqrt(sumSquares / levelData.length);
	}

	function recordOneChunk(): Promise<Blob | null> {
		return new Promise((resolve, reject) => {
			const collected: Blob[] = [];
			const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
			activeRecorder = recorder;
			const startedAt = Date.now();
			let silenceSince: number | null = null;

			const pollTimer = setInterval(() => {
				if (stopped) {
					recorder.stop();
					return;
				}
				const rms = currentRms();
				options.onLevel?.(rms);
				const elapsed = Date.now() - startedAt;

				if (rms < SILENCE_RMS_THRESHOLD) {
					if (silenceSince === null) silenceSince = Date.now();
				} else {
					silenceSince = null;
				}

				const silenceHeld = silenceSince !== null && Date.now() - silenceSince >= SILENCE_HOLD_MS;
				const hitMax = elapsed >= MAX_CHUNK_MS;

				if (elapsed >= MIN_CHUNK_MS && (silenceHeld || hitMax)) {
					recorder.stop();
				}
			}, POLL_INTERVAL_MS);

			recorder.ondataavailable = (event) => {
				if (event.data.size > 0) collected.push(event.data);
			};
			recorder.onstop = () => {
				clearInterval(pollTimer);
				resolve(collected.length ? new Blob(collected, { type: mimeType }) : null);
			};
			recorder.onerror = (event) => {
				clearInterval(pollTimer);
				reject(event);
			};

			recorder.start();
		});
	}

	void (async function loop() {
		try {
			while (!stopped) {
				const blob = await recordOneChunk();
				if (stopped) break;
				if (blob && blob.size > 0) {
					const audioBase64 = await blobToBase64(blob);
					await options.onChunk(audioBase64);
				}
			}
		} catch (error) {
			options.onError?.(error);
		} finally {
			for (const track of stream.getTracks()) track.stop();
			await audioContext.close();
		}
	})();

	return {
		stop: () => {
			stopped = true;
			activeRecorder?.stop();
		},
	};
}
