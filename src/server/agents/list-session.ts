import { Agent, callable } from "agents";
import type { DraftItem, SessionState } from "../../shared/types";
import { categorizeItems, estimatePrices, extractItems } from "../lib/extract";
import { finalizeList } from "../lib/db";

// Items aren't categorized until finalize (see DraftItem), so the exclusion
// key is just the name now - fine in practice, since a duplicate item name
// across two different categories is not a real grocery-list scenario.
function itemKey(item: Pick<DraftItem, "name">): string {
	return item.name.trim().toLowerCase();
}

export class ListSessionAgent extends Agent<Env, SessionState> {
	initialState: SessionState = {
		transcript: "",
		items: [],
		status: "idle",
		finalizedSlug: null,
		deletedItemKeys: [],
	};

	// Transcription happens in the browser (Web Speech API), so segments
	// arrive here as already-recognized text, not audio. They can still arrive
	// faster than the extraction call (Llama) processes them during continuous
	// speech, so we chain them onto this queue to guarantee they're appended
	// in the order they were spoken - never interleaved or racing each other
	// for `this.state`.
	private segmentQueue: Promise<void> = Promise.resolve();

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
		this.segmentQueue = this.segmentQueue.then(() => this.processSegment(text)).catch((error) => {
			console.error("Failed to process transcript segment", error);
		});
	}

	private async processSegment(text: string) {
		if (this.state.finalizedSlug || !text.trim()) return;

		const transcript = `${this.state.transcript} ${text}`.trim();
		this.setState({ ...this.state, transcript });
		this.triggerExtraction();
	}

	@callable()
	deleteItem(itemId: string) {
		const item = this.state.items.find((i) => i.id === itemId);
		if (!item) return;

		this.setState({
			...this.state,
			items: this.state.items.filter((i) => i.id !== itemId),
			// Remembered for the rest of the session so the next re-extraction
			// (which re-derives the full list from the transcript) doesn't just
			// bring the same mis-heard item straight back.
			deletedItemKeys: [...this.state.deletedItemKeys, itemKey(item)],
		});
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

		let items;
		try {
			items = (await extractItems(this.env, this.state.transcript)).filter(
				(item) => !this.state.deletedItemKeys.includes(itemKey(item)),
			);
		} catch (error) {
			// A transient extraction failure shouldn't blank out a list that was
			// already showing correctly - just leave it as-is. The next
			// segment re-extracts from the full transcript anyway, so this
			// self-heals rather than needing an explicit retry here.
			console.error("Extraction failed, keeping previous items", error);
			if (this.state.finalizedSlug) return;
			this.setState({ ...this.state, status: "recording" });
			return;
		}

		if (this.state.finalizedSlug) return;

		// A non-empty transcript extracting to zero items, after we already
		// had some, is far more likely a parsing/response hiccup than the
		// speaker actually retracting everything - don't wipe a good list on
		// what's probably a fluke.
		if (items.length === 0 && this.state.items.length > 0) {
			console.error("Extraction returned no items despite an existing list - keeping previous items");
			this.setState({ ...this.state, status: "recording" });
			return;
		}

		this.setState({ ...this.state, items, status: "recording" });
	}

	@callable()
	async finalize(): Promise<{ slug: string }> {
		// Make sure any segments still in flight are accounted for, including
		// a coalesced catch-up extraction pass, so the shared list reflects
		// everything actually said.
		await this.segmentQueue;
		while (this.extractionInFlight) {
			await this.extractionInFlight;
		}

		if (this.state.finalizedSlug) {
			return { slug: this.state.finalizedSlug };
		}
		const categorized = await categorizeItems(this.env, this.state.items);
		const priced = await estimatePrices(this.env, categorized);
		const slug = await finalizeList(this.env.DB, this.state.transcript, priced);
		this.setState({ ...this.state, status: "done", finalizedSlug: slug });
		return { slug };
	}
}
