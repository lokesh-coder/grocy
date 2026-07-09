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

	// Appending a segment to the transcript is instant, but re-extracting the
	// item list (Llama) takes real time. During continuous speech, phrases can
	// finalize faster than extraction completes - if we ran one extraction
	// call per segment in sequence, the list would fall further and further
	// behind the longer someone talks. Instead we only ever run one
	// extraction at a time; if more segments arrive while it's in flight, we
	// mark a catch-up pass as pending and run exactly one more (using
	// whatever the transcript has grown to by then) once the current call
	// finishes - never a backlog of one-per-segment calls.
	private extractionInFlight: Promise<void> | null = null;
	private extractionPending = false;

	@callable()
	addTranscriptSegment(text: string) {
		if (this.state.finalizedSlug || !text.trim()) return;

		const transcript = `${this.state.transcript} ${text}`.trim();
		this.setState({ ...this.state, transcript });
		this.triggerExtraction();
	}

	private triggerExtraction() {
		if (this.extractionInFlight) {
			this.extractionPending = true;
			return;
		}
		this.extractionInFlight = this.runExtraction().finally(() => {
			this.extractionInFlight = null;
			if (this.extractionPending) {
				this.extractionPending = false;
				this.triggerExtraction();
			}
		});
	}

	private async runExtraction() {
		if (this.state.finalizedSlug) return;
		this.setState({ ...this.state, status: "extracting" });

		const items = await extractItems(this.env.AI, this.state.transcript);

		if (this.state.finalizedSlug) return;
		this.setState({ ...this.state, items, status: "recording" });
	}

	@callable()
	async finalize(): Promise<{ slug: string }> {
		// Drain any extraction still in flight, including a coalesced catch-up
		// pass that might get scheduled right after it, so the shared list
		// reflects everything actually said.
		while (this.extractionInFlight) {
			await this.extractionInFlight;
		}

		if (this.state.finalizedSlug) {
			return { slug: this.state.finalizedSlug };
		}
		const slug = await finalizeList(this.env.DB, this.state.transcript, this.state.items);
		this.setState({ ...this.state, status: "done", finalizedSlug: slug });
		return { slug };
	}
}
