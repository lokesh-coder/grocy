import { Agent, callable } from "agents";
import type { SessionState } from "../../shared/types";
import { extractItems } from "../lib/extract";
import { finalizeList } from "../lib/db";
import { base64ToBytes, bytesToBase64, wrapPcmAsWav } from "../lib/wav";

const SARVAM_SAMPLE_RATE = 16000;

type SarvamMessage =
	| { type: "data"; data: { transcript?: string } }
	| { type: "error"; data: { message?: string } }
	| { type: "events"; data: unknown };

export class ListSessionAgent extends Agent<Env, SessionState> {
	initialState: SessionState = {
		transcript: "",
		items: [],
		status: "idle",
		finalizedSlug: null,
	};

	// Persistent outbound WebSocket to Sarvam's streaming STT for the current
	// recording session. Audio streams to it continuously (no dead air);
	// Sarvam's own server-side VAD segments it and pushes transcripts back on
	// its own - see closeSarvamConnection() for the one place we still send
	// an explicit flush (on stop/finalize, to catch trailing speech).
	private sarvamSocket: WebSocket | null = null;
	private sarvamConnecting: Promise<void> | null = null;
	private pendingFlushResolvers: Array<() => void> = [];

	// Same extraction-coalescing pattern as before: appending transcript text
	// is instant, but only one Llama extraction call runs at a time, with at
	// most one more queued up to catch up on whatever arrived meanwhile.
	private extractionInFlight: Promise<void> | null = null;
	private extractionPending = false;

	private async ensureSarvamConnection(): Promise<void> {
		if (this.sarvamSocket && this.sarvamSocket.readyState === WebSocket.READY_STATE_OPEN) return;
		if (this.sarvamConnecting) return this.sarvamConnecting;

		this.sarvamConnecting = (async () => {
			// Workers' outbound WebSocket pattern upgrades over a normal https://
			// fetch() (the Upgrade header triggers it, not a wss:// scheme).
			// vad_signals + high_vad_sensitivity let Sarvam's own (trained,
			// server-side) voice-activity detection decide when a phrase has
			// ended and push a transcript on its own - confirmed empirically
			// this is what actually drives live results, not periodic flush.
			const url =
				"https://api.sarvam.ai/speech-to-text/ws" +
				`?language-code=ta-IN&model=saaras:v3&mode=transcribe` +
				`&sample_rate=${SARVAM_SAMPLE_RATE}&input_audio_codec=wav` +
				`&vad_signals=true&high_vad_sensitivity=true`;

			const response = await fetch(url, {
				headers: {
					Upgrade: "websocket",
					"Api-Subscription-Key": this.env.SARVAM_API_KEY,
				},
			});

			const ws = response.webSocket;
			if (!ws) throw new Error("Sarvam did not accept the WebSocket upgrade");

			ws.accept();
			ws.addEventListener("message", (event) => this.handleSarvamMessage(event.data));
			ws.addEventListener("close", () => {
				if (this.sarvamSocket === ws) this.sarvamSocket = null;
			});
			ws.addEventListener("error", () => {
				console.error("Sarvam WebSocket error");
			});

			this.sarvamSocket = ws;
		})();

		try {
			await this.sarvamConnecting;
		} finally {
			this.sarvamConnecting = null;
		}
	}

	private handleSarvamMessage(raw: string | ArrayBuffer) {
		if (typeof raw !== "string") return;

		let message: SarvamMessage;
		try {
			message = JSON.parse(raw);
		} catch {
			return;
		}

		if (message.type === "error") {
			console.error("Sarvam transcription error:", message.data?.message);
			this.resolvePendingFlushes();
			return;
		}
		if (message.type !== "data") return;

		// Unblocks anyone waiting in closeSarvamConnection() for a flush to be
		// answered before it's safe to close the connection.
		this.resolvePendingFlushes();

		const text = String(message.data.transcript ?? "").trim();
		if (!text || this.state.finalizedSlug) return;

		const transcript = `${this.state.transcript} ${text}`.trim();
		this.setState({ ...this.state, transcript });
		this.triggerExtraction();
	}

	private resolvePendingFlushes() {
		for (const resolve of this.pendingFlushResolvers.splice(0)) resolve();
	}

	@callable()
	async pushAudio(base64Pcm: string) {
		if (this.state.finalizedSlug) return;
		try {
			await this.ensureSarvamConnection();
		} catch (error) {
			console.error("Failed to connect to Sarvam", error);
			return;
		}
		if (!this.sarvamSocket) return;

		const wav = wrapPcmAsWav(base64ToBytes(base64Pcm), SARVAM_SAMPLE_RATE);
		this.sarvamSocket.send(
			JSON.stringify({
				audio: { data: bytesToBase64(wav), sample_rate: String(SARVAM_SAMPLE_RATE), encoding: "audio/wav" },
			}),
		);
	}

	// Asks Sarvam for anything still buffered and waits for it to answer
	// (with a timeout fallback) before closing. Closing immediately after
	// sending flush - without waiting - risked silently dropping the last
	// phrase spoken right before the user hit stop, if the response hadn't
	// arrived yet.
	private async closeSarvamConnection(): Promise<void> {
		if (!this.sarvamSocket) return;

		const flushAnswered = new Promise<void>((resolve) => {
			this.pendingFlushResolvers.push(resolve);
		});
		this.sarvamSocket.send(JSON.stringify({ type: "flush" }));
		await Promise.race([flushAnswered, new Promise<void>((resolve) => setTimeout(resolve, 2500))]);

		this.sarvamSocket?.close();
		this.sarvamSocket = null;
	}

	@callable()
	async stopStreaming() {
		await this.closeSarvamConnection();
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
			items = await extractItems(this.env.AI, this.state.transcript);
		} catch (error) {
			// A transient Llama failure shouldn't blank out a list that was
			// already showing correctly - just leave it as-is. The next VAD
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
		// Covers finalize being called without an explicit stop first (e.g.
		// clicking "Done" while still recording).
		await this.closeSarvamConnection();

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
