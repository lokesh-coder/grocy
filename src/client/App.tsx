import { useEffect, useState } from "react";
import { useAgent } from "agents/react";
import { ShoppingCart, Plus } from "@phosphor-icons/react";
import { Recorder } from "./components/Recorder";
import { LiveList } from "./components/LiveList";
import { SharedListPage } from "./components/SharedListPage";
import type { SessionState } from "../shared/types";

const SESSION_STORAGE_KEY = "grocy-session-id";

function getOrCreateSessionId(): string {
	const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
	if (existing) return existing;
	const created = crypto.randomUUID();
	sessionStorage.setItem(SESSION_STORAGE_KEY, created);
	return created;
}

function startNewList() {
	sessionStorage.removeItem(SESSION_STORAGE_KEY);
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
