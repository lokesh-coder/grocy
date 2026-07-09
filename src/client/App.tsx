import { useEffect, useState } from "react";
import { useAgent } from "agents/react";
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

	const agent = useAgent<SessionState>({
		agent: "ListSessionAgent",
		name: sessionId,
	});

	const state = agent.state;
	const hasContent = (state?.transcript.length ?? 0) > 0 || (state?.items.length ?? 0) > 0;

	return (
		<div className="app-shell">
			<header className="top-bar">
				<span className="app-title">🛒 மளிகை பட்டியல்</span>
				{hasContent && (
					<button className="new-list-button" onClick={startNewList}>
						+ புதிய பட்டியல்
					</button>
				)}
			</header>
			<div className="app-layout">
				<Recorder
					transcript={state?.transcript ?? ""}
					status={state?.status ?? "idle"}
					onSegment={async (text) => {
						await agent.stub.addTranscriptSegment(text);
					}}
				/>
				<LiveList
					items={state?.items ?? []}
					onFinalize={async () => {
						return await agent.stub.finalize();
					}}
				/>
			</div>
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
