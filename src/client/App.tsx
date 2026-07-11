import { useEffect, useState } from "react";
import { useAgent } from "agents/react";
import { ShoppingCart, Plus } from "@phosphor-icons/react";
import { Recorder } from "./components/Recorder";
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
	const [isRecording, setIsRecording] = useState(false);

	const agent = useAgent<SessionState>({
		agent: "ListSessionAgent",
		name: sessionId,
	});

	const state = agent.state;
	const hasContent = (state?.transcript.length ?? 0) > 0 || (state?.items.length ?? 0) > 0;

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
					status={state?.status ?? "idle"}
					isRecording={isRecording}
					onFinalize={async () => {
						return await agent.stub.finalize();
					}}
					onDelete={(itemId) => {
						agent.stub.deleteItem(itemId);
					}}
					onQuickAdd={(text) => {
						agent.stub.addTranscriptSegment(text);
					}}
				/>
				<Recorder
					transcript={state?.transcript ?? ""}
					status={state?.status ?? "idle"}
					onSegment={(text) => {
						agent.stub.addTranscriptSegment(text);
					}}
					onRecordingChange={setIsRecording}
				/>
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
