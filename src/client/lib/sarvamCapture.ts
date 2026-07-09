// Captures microphone audio continuously (never stopped/restarted while
// recording - that dead-air pattern is what caused garbled transcription
// with the old Whisper-based approach) and streams it to the server as raw
// 16-bit PCM via an AudioWorklet.
//
// Segmenting live speech into phrases is handled entirely server-side by
// Sarvam's own voice-activity detection (see list-session.ts) - it pushes a
// transcript on its own once it detects a pause, which is both faster and
// more accurate than guessing from a client-side volume threshold. Flushing
// any trailing speech on stop is also handled server-side (stopStreaming),
// so this module only needs to worry about capturing audio.

const SAMPLE_RATE = 16000;

export type SarvamCaptureHandle = {
	stop: () => void;
};

export type SarvamCaptureOptions = {
	onAudioChunk: (base64Pcm: string) => void;
	onError?: (error: unknown) => void;
};

function bufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = "";
	for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
	return btoa(binary);
}

export async function startSarvamCapture(options: SarvamCaptureOptions): Promise<SarvamCaptureHandle> {
	// Chrome's default audio processing (echo cancellation, noise suppression,
	// auto-gain) is tuned for human listening on voice calls, not for feeding
	// a speech-recognition model - it can strip acoustic detail or introduce
	// artifacts that hurt accuracy. Sarvam says it handles raw background
	// noise robustly on its own, so send it unprocessed audio rather than
	// double-processing.
	const stream = await navigator.mediaDevices.getUserMedia({
		audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
	});
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

		return {
			stop: () => {
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
