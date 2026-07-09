import { Agent, callable } from "agents";
import type { SessionState } from "../../shared/types";
import { transcribeChunk } from "../lib/transcribe";
import { extractItems } from "../lib/extract";
import { finalizeList } from "../lib/db";

export class ListSessionAgent extends Agent<Env, SessionState> {
	initialState: SessionState = {
		transcript: "",
		items: [],
		status: "idle",
		finalizedSlug: null,
	};

	// The client records continuously and fires a chunk off in the background
	// as soon as it's cut, without waiting for it to finish processing (waiting
	// would leave the mic dead for the duration of the AI calls and drop
	// whatever was said in the meantime). That means chunks can arrive here
	// faster than they're processed, so we chain them onto this queue to
	// guarantee they're transcribed and appended in the order they were
	// spoken - never interleaved or racing each other for `this.state`.
	private chunkQueue: Promise<void> = Promise.resolve();

	@callable()
	addChunk(audioBase64: string) {
		this.chunkQueue = this.chunkQueue.then(() => this.processChunk(audioBase64)).catch((error) => {
			console.error("Failed to process audio chunk", error);
		});
	}

	private async processChunk(audioBase64: string) {
		if (this.state.finalizedSlug) return;
		this.setState({ ...this.state, status: "transcribing" });

		const spoken = await transcribeChunk(this.env.AI, audioBase64);
		const transcript = spoken ? `${this.state.transcript} ${spoken}`.trim() : this.state.transcript;

		// Broadcast the transcript as soon as it's ready, before waiting on the
		// (slower) extraction call, so the left pane feels live even though the
		// list on the right catches up a beat later.
		this.setState({ ...this.state, transcript, status: "extracting" });

		const items = await extractItems(this.env.AI, transcript);

		this.setState({ ...this.state, transcript, items, status: "recording" });
	}

	@callable()
	async finalize(): Promise<{ slug: string }> {
		// Make sure any chunks still in flight are accounted for before
		// finalizing, so the shared list reflects everything actually said.
		await this.chunkQueue;

		if (this.state.finalizedSlug) {
			return { slug: this.state.finalizedSlug };
		}
		const slug = await finalizeList(this.env.DB, this.state.transcript, this.state.items);
		this.setState({ ...this.state, status: "done", finalizedSlug: slug });
		return { slug };
	}
}
