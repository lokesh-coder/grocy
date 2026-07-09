// Captures microphone audio continuously (never stopped/restarted while
// recording - that dead-air pattern is what caused garbled transcription
// with the old Whisper-based approach) and streams it to the server as raw
// 16-bit PCM via an AudioWorklet. A separate, lightweight silence detector
// decides when to ask the server for an incremental transcript checkpoint
// (`onFlush`), without ever interrupting the audio stream itself.

const SAMPLE_RATE = 16000;
const SILENCE_RMS_THRESHOLD = 0.02;
const SILENCE_HOLD_MS = 700;
const MAX_FLUSH_INTERVAL_MS = 6000;
const POLL_INTERVAL_MS = 100;

export type SarvamCaptureHandle = {
	stop: () => void;
};

export type SarvamCaptureOptions = {
	onAudioChunk: (base64Pcm: string) => void;
	onFlush: () => void;
	onError?: (error: unknown) => void;
};

function bufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = "";
	for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
	return btoa(binary);
}

export async function startSarvamCapture(options: SarvamCaptureOptions): Promise<SarvamCaptureHandle> {
	const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
	const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });

	try {
		const workletUrl = new URL("./pcm-worklet.js", import.meta.url);
		await audioContext.audioWorklet.addModule(workletUrl);

		const source = audioContext.createMediaStreamSource(stream);

		const workletNode = new AudioWorkletNode(audioContext, "pcm-capture-processor");
		workletNode.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
			options.onAudioChunk(bufferToBase64(event.data));
		};
		source.connect(workletNode);

		// Separate analyser purely to decide *when* to request a checkpoint -
		// capture above is never paused, so there's no dead air either way.
		const analyser = audioContext.createAnalyser();
		analyser.fftSize = 1024;
		source.connect(analyser);
		const levelData = new Uint8Array(analyser.fftSize);

		let silenceSince: number | null = null;
		let flushedForThisSilence = false;
		let lastFlushAt = Date.now();
		let stopped = false;

		const pollTimer = setInterval(() => {
			if (stopped) return;

			analyser.getByteTimeDomainData(levelData);
			let sumSquares = 0;
			for (let i = 0; i < levelData.length; i++) {
				const centered = (levelData[i] - 128) / 128;
				sumSquares += centered * centered;
			}
			const rms = Math.sqrt(sumSquares / levelData.length);

			if (rms < SILENCE_RMS_THRESHOLD) {
				if (silenceSince === null) silenceSince = Date.now();
			} else {
				silenceSince = null;
				flushedForThisSilence = false;
			}

			const silenceHeld = silenceSince !== null && Date.now() - silenceSince >= SILENCE_HOLD_MS;
			const hitMaxInterval = Date.now() - lastFlushAt >= MAX_FLUSH_INTERVAL_MS;

			if ((silenceHeld && !flushedForThisSilence) || hitMaxInterval) {
				flushedForThisSilence = true;
				lastFlushAt = Date.now();
				options.onFlush();
			}
		}, POLL_INTERVAL_MS);

		return {
			stop: () => {
				stopped = true;
				clearInterval(pollTimer);
				options.onFlush();
				for (const track of stream.getTracks()) track.stop();
				void audioContext.close();
			},
		};
	} catch (error) {
		for (const track of stream.getTracks()) track.stop();
		void audioContext.close();
		throw error;
	}
}
