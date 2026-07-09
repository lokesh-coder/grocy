export async function transcribeChunk(ai: Ai, audioBase64: string): Promise<string> {
	const result = await ai.run("@cf/openai/whisper-large-v3-turbo", {
		audio: audioBase64,
		language: "ta",
	});

	const text = (result as { text?: string }).text;
	return text?.trim() ?? "";
}
