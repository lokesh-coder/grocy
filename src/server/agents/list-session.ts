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

	// Chunks are sent one at a time by the client, which awaits each call before
	// recording the next segment - so this only ever runs for one chunk at a time
	// per session and there's no need for extra queueing here.
	@callable()
	async addChunk(audioBase64: string) {
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
		if (this.state.finalizedSlug) {
			return { slug: this.state.finalizedSlug };
		}
		const slug = await finalizeList(this.env.DB, this.state.transcript, this.state.items);
		this.setState({ ...this.state, status: "done", finalizedSlug: slug });
		return { slug };
	}
}
