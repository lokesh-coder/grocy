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

	// Transcription happens in the browser (Web Speech API), so segments
	// arrive here as already-recognized text, not audio. Segments are only
	// accumulated into the transcript here - extraction doesn't run live
	// anymore (see finalize) - so this queue just guarantees they're appended
	// in the order they were spoken, never interleaved or racing each other
	// for `this.state`.
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
		this.setState({ ...this.state, transcript, status: "recording" });
	}

	// Extraction only runs once, here, over the complete transcript - not on
	// every segment while dictating. Live extraction added real latency to
	// every single thing said, and got slower as a session went on (more
	// transcript to re-reason over each time) for no benefit tied to what was
	// just said. The live view now just echoes raw segments as they arrive
	// (see the client) - the actual structured list only exists after this.
	@callable()
	async finalize(): Promise<{ slug: string }> {
		await this.segmentQueue;

		if (this.state.finalizedSlug) {
			return { slug: this.state.finalizedSlug };
		}

		this.setState({ ...this.state, status: "extracting" });
		const items = await extractItems(this.env, this.state.transcript);
		this.setState({ ...this.state, items, status: "recording" });

		// Categorizing and pricing happen on demand on the shared list page
		// instead of here (see /api/list/:slug/organize), so this is just one
		// extraction call plus a single D1 write.
		const slug = await finalizeList(this.env.DB, this.state.transcript, items);
		this.setState({ ...this.state, status: "done", finalizedSlug: slug });
		return { slug };
	}
}
