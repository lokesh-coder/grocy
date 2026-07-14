import { useEffect, useRef, useState } from "react";
import { AgentClient } from "agents/client";
import { AccessAwareWebSocket, API_HOST } from "./config";
import type { SessionState } from "../shared/types";

// Uses AgentClient directly rather than the useAgent hook from agents/react
// - see polyfills.ts and the Phase 0 commit for why (agents/react.js
// reimplements its own RPC/message handling separately from client.js, and
// that's not what got exercised while chasing down the crypto.randomUUID
// gap). This wraps the exact client class already verified working
// end-to-end on-device.
export function useSessionAgent(sessionId: string | null) {
	const [state, setState] = useState<SessionState | undefined>();
	const [connected, setConnected] = useState(false);
	const clientRef = useRef<AgentClient<SessionState> | null>(null);

	useEffect(() => {
		if (!sessionId) return;
		const client = new AgentClient<SessionState>({
			agent: "ListSessionAgent",
			name: sessionId,
			host: API_HOST,
			WebSocket: AccessAwareWebSocket,
		});
		clientRef.current = client;
		setConnected(false);
		setState(undefined);
		client.addEventListener("open", () => setConnected(true));
		client.addEventListener("close", () => setConnected(false));
		client.addEventListener("message", (event: MessageEvent) => {
			if (typeof event.data !== "string") return;
			try {
				const parsed = JSON.parse(event.data);
				if (parsed.type === "cf_agent_state") setState(parsed.state);
			} catch {
				// not JSON / not a state message - ignore
			}
		});
		return () => {
			client.close();
			clientRef.current = null;
		};
	}, [sessionId]);

	return { clientRef, state, connected };
}
