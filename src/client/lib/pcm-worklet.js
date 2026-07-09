// Runs on the audio rendering thread (AudioWorkletGlobalScope), not the main
// thread - plain JS, not part of the TypeScript program. Accumulates raw
// Float32 samples into ~200ms buffers, converts to 16-bit PCM, and posts
// each buffer back to the main thread as it fills.
class PCMCaptureProcessor extends AudioWorkletProcessor {
	constructor() {
		super();
		this.buffer = [];
		this.targetChunkSize = 3200; // ~200ms at 16kHz
	}

	process(inputs) {
		const channelData = inputs[0]?.[0];
		if (channelData) {
			for (let i = 0; i < channelData.length; i++) {
				this.buffer.push(channelData[i]);
			}
			while (this.buffer.length >= this.targetChunkSize) {
				const chunk = this.buffer.splice(0, this.targetChunkSize);
				const pcm16 = new Int16Array(chunk.length);
				for (let i = 0; i < chunk.length; i++) {
					const sample = Math.max(-1, Math.min(1, chunk[i]));
					pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
				}
				this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
			}
		}
		return true;
	}
}

registerProcessor("pcm-capture-processor", PCMCaptureProcessor);
