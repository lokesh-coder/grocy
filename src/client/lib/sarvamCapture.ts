// Captures microphone audio continuously (never stopped/restarted while
// recording - that dead-air pattern is what caused garbled transcription
// with the old Whisper-based approach) and streams it to the server as raw
// 16-bit PCM via an AudioWorklet.
//
// Segmenting live speech into phrases is handled entirely server-side by
// Sarvam's own voice-activity detection (see list-session.ts) - it pushes a
// transcript on its own once it detects a pause, which is both faster and
// more accurate than guessing from a client-side volume threshold. `onFlush`
// here is just a safety net fired once on stop, to catch any trailing speech
// Sarvam's VAD hasn't flushed yet.

const SAMPLE_RATE = 16000;

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

		return {
			stop: () => {
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
