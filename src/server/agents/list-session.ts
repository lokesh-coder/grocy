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
	// `flush()` asks it to return an incremental transcript checkpoint for
	// whatever's arrived since the last flush, without ending the session.
	private sarvamSocket: WebSocket | null = null;
	private sarvamConnecting: Promise<void> | null = null;

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
			const url =
				"https://api.sarvam.ai/speech-to-text/ws" +
				`?language-code=ta-IN&model=saaras:v3&mode=transcribe` +
				`&sample_rate=${SARVAM_SAMPLE_RATE}&input_audio_codec=wav`;

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
			return;
		}
		if (message.type !== "data") return;

		const text = String(message.data.transcript ?? "").trim();
		if (!text || this.state.finalizedSlug) return;

		const transcript = `${this.state.transcript} ${text}`.trim();
		this.setState({ ...this.state, transcript });
		this.triggerExtraction();
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

	@callable()
	flush() {
		this.sarvamSocket?.send(JSON.stringify({ type: "flush" }));
	}

	@callable()
	stopStreaming() {
		this.sarvamSocket?.close();
		this.sarvamSocket = null;
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
		this.sarvamSocket?.close();
		this.sarvamSocket = null;

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
