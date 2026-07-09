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

function RecordingView() {
	const [sessionId] = useState(getOrCreateSessionId);

	const agent = useAgent<SessionState>({
		agent: "ListSessionAgent",
		name: sessionId,
	});

	const state = agent.state;

	return (
		<div className="app-layout">
			<Recorder
				transcript={state?.transcript ?? ""}
				status={state?.status ?? "idle"}
				onChunk={async (audioBase64) => {
					await agent.stub.addChunk(audioBase64);
				}}
			/>
			<LiveList
				items={state?.items ?? []}
				onFinalize={async () => {
					return await agent.stub.finalize();
				}}
			/>
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
