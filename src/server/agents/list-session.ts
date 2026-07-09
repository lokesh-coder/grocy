import { Agent, callable } from "agents";
import type { SessionState } from "../../shared/types";
import { extractItems } from "../lib/extract";
import { finalizeList } from "../lib/db";

export class ListSessionAgent extends Agent<Env, SessionState> {
	initialState: SessionState = {
		transcript: "",
		items: [],
		status: "idle",
		finalizedSlug: null,
	};

	// Transcription now happens in the browser (Web Speech API), so segments
	// arrive here as already-recognized text, not audio. They can still arrive
	// faster than the extraction call (Llama) processes them during continuous
	// speech, so we chain them onto this queue to guarantee they're appended
	// and re-extracted in the order they were spoken - never interleaved or
	// racing each other for `this.state`.
	private segmentQueue: Promise<void> = Promise.resolve();

	@callable()
	addTranscriptSegment(text: string) {
		this.segmentQueue = this.segmentQueue.then(() => this.processSegment(text)).catch((error) => {
			console.error("Failed to process transcript segment", error);
		});
	}

	private async processSegment(text: string) {
		if (this.state.finalizedSlug || !text.trim()) return;

		const transcript = `${this.state.transcript} ${text}`.trim();
		this.setState({ ...this.state, transcript, status: "extracting" });

		const items = await extractItems(this.env.AI, transcript);

		this.setState({ ...this.state, transcript, items, status: "recording" });
	}

	@callable()
	async finalize(): Promise<{ slug: string }> {
		// Make sure any segments still in flight are accounted for before
		// finalizing, so the shared list reflects everything actually said.
		await this.segmentQueue;

		if (this.state.finalizedSlug) {
			return { slug: this.state.finalizedSlug };
		}
		const slug = await finalizeList(this.env.DB, this.state.transcript, this.state.items);
		this.setState({ ...this.state, status: "done", finalizedSlug: slug });
		return { slug };
	}
}
