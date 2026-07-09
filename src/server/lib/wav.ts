// Sarvam's streaming API requires every message to carry a standalone, valid
// WAV file (its own 44-byte header) - confirmed empirically against the real
// API, since the docs were ambiguous about raw-PCM framing and it actually
// rejects "audio/pcm" outright ("Input should be 'audio/wav'"). Multiple
// small WAV-wrapped chunks sent over one connection are still correctly
// stitched into one continuous transcript by the server.
export function wrapPcmAsWav(pcm: Uint8Array, sampleRate: number): Uint8Array {
	const header = new Uint8Array(44);
	const view = new DataView(header.buffer);
	const dataSize = pcm.length;

	const writeString = (offset: number, text: string) => {
		for (let i = 0; i < text.length; i++) header[offset + i] = text.charCodeAt(i);
	};

	writeString(0, "RIFF");
	view.setUint32(4, 36 + dataSize, true);
	writeString(8, "WAVE");
	writeString(12, "fmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true); // PCM
	view.setUint16(22, 1, true); // mono
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * 2, true); // byte rate (sampleRate * blockAlign)
	view.setUint16(32, 2, true); // block align (16-bit mono)
	view.setUint16(34, 16, true); // bits per sample
	writeString(36, "data");
	view.setUint32(40, dataSize, true);

	const wav = new Uint8Array(44 + dataSize);
	wav.set(header, 0);
	wav.set(pcm, 44);
	return wav;
}

export function base64ToBytes(base64: string): Uint8Array {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
	let binary = "";
	for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
	return btoa(binary);
}
