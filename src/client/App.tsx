import { useEffect, useRef, useState } from "react";
import { useAgent } from "agents/react";
import { CheckCircle, Eye, Plus, ShareNetwork, ShoppingCart, WhatsappLogo } from "@phosphor-icons/react";
import { Recorder, type RecorderHandle } from "./components/Recorder";
import { LiveList } from "./components/LiveList";
import { SharedListPage } from "./components/SharedListPage";
import type { SessionState } from "../shared/types";

// localStorage (not sessionStorage) so an in-progress list survives the PWA
// being fully closed mid-dictation, not just backgrounded - a phone can get
// killed by the OS for memory at any point. The id is cleared as soon as a
// list is finalized (see the effect in RecordingView below), so a completed
// list still starts fresh next time rather than lingering forever.
const SESSION_STORAGE_KEY = "grocy-session-id";

function getOrCreateSessionId(): string {
	const existing = localStorage.getItem(SESSION_STORAGE_KEY);
	if (existing) return existing;
	const created = crypto.randomUUID();
	localStorage.setItem(SESSION_STORAGE_KEY, created);
	return created;
}

function startNewList() {
	localStorage.removeItem(SESSION_STORAGE_KEY);
	window.location.reload();
}

function RecordingView() {
	const [sessionId] = useState(getOrCreateSessionId);
	const recorderRef = useRef<RecorderHandle>(null);
	// Raw, unprocessed segments as they're recognized - purely a local echo
	// so the live view updates instantly with no server round-trip. The real
	// transcript still goes to the Durable Object below for persistence and
	// the one real extraction pass at finalize.
	const [segments, setSegments] = useState<string[]>([]);

	const agent = useAgent<SessionState>({
		agent: "ListSessionAgent",
		name: sessionId,
	});

	const state = agent.state;
	const hasContent = segments.length > 0 || (state?.items.length ?? 0) > 0;
	// Derived straight from synced state rather than tracked separately - the
	// moment finalize() succeeds, this flips and the bottom bar swaps from
	// the mic (nothing left to record) to the share/view/new-list actions.
	const shareUrl = state?.finalizedSlug ? `${window.location.origin}/list/${state.finalizedSlug}` : null;
	const [copied, setCopied] = useState(false);

	function addSegment(text: string) {
		setSegments((prev) => [...prev, text]);
		agent.stub.addTranscriptSegment(text);
	}

	async function handleShare() {
		if (!shareUrl) return;
		if (navigator.share) {
			try {
				await navigator.share({ title: "மளிகை பட்டியல்", url: shareUrl });
				return;
			} catch {
				// user cancelled or share failed - fall through to clipboard
			}
		}
		await navigator.clipboard.writeText(shareUrl);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	useEffect(() => {
		if (state?.finalizedSlug) {
			localStorage.removeItem(SESSION_STORAGE_KEY);
		}
	}, [state?.finalizedSlug]);

	return (
		<div className="app-shell">
			<header className="top-bar">
				<span className="app-title">
					<ShoppingCart weight="duotone" size={20} />
					மளிகை பட்டியல்
				</span>
				{hasContent && (
					<button className="new-list-button" onClick={startNewList}>
						<Plus weight="bold" size={14} />
						புதியது
					</button>
				)}
			</header>
			<main className="main-area">
				<LiveList
					items={state?.items ?? []}
					segments={segments}
					isFinalized={!!shareUrl}
					onFinalize={async () => {
						// Stop the mic first, in case Done is clicked mid-recording -
						// otherwise it keeps listening even after the list is finalized.
						recorderRef.current?.stop();
						return await agent.stub.finalize();
					}}
					onQuickAdd={addSegment}
				/>
				{shareUrl ? (
					<div className="share-actions-bar">
						<span className="confetti-burst" aria-hidden="true">
							<span className="confetti-piece" />
							<span className="confetti-piece" />
							<span className="confetti-piece" />
							<span className="confetti-piece" />
							<span className="confetti-piece" />
							<span className="confetti-piece" />
						</span>
						<button className="action-icon-button" aria-label="புதிய பட்டியல்" onClick={startNewList}>
							<Plus weight="bold" size={20} />
						</button>
						<a
							className="action-icon-button whatsapp"
							aria-label="WhatsApp-இல் பகிரவும்"
							href={`https://wa.me/?text=${encodeURIComponent(`மளிகை பட்டியல்: ${shareUrl}`)}`}
							target="_blank"
							rel="noreferrer"
						>
							<WhatsappLogo weight="fill" size={24} />
						</a>
						<button className="action-icon-button" aria-label="பகிரவும்" onClick={handleShare}>
							{copied ? <CheckCircle weight="fill" size={20} /> : <ShareNetwork weight="bold" size={20} />}
						</button>
						{/* No target="_blank" - a detached window has no back-stack in the installed PWA. */}
						<a className="action-icon-button" aria-label="பட்டியலைப் பார்" href={shareUrl}>
							<Eye weight="bold" size={20} />
						</a>
					</div>
				) : (
					<Recorder ref={recorderRef} onSegment={addSegment} />
				)}
			</main>
		</div>
	);
}

export function App() {
	const [pathname, setPathname] = useState(window.location.pathname);

	useEffect(() => {
		const onPopState = () => setPathname(window.location.pathname);
		window.addEventListener("popstate", onPopState);
		return () => window.removeEventListener("popstate", onPopState);
	}, []);

	const listMatch = pathname.match(/^\/list\/([^/]+)$/);
	if (listMatch) {
		return <SharedListPage slug={listMatch[1]} />;
	}

	return <RecordingView />;
}
