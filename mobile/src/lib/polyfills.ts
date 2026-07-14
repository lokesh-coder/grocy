// Must be imported before any `agents`/`partysocket` import, and after
// react-native-get-random-values (see index.ts). react-native-get-random-
// values only provides crypto.getRandomValues, NOT crypto.randomUUID -
// partysocket's own connection-setup code tolerates that (it falls back to
// a manual UUID when crypto.randomUUID is missing), which is why connecting
// worked fine, but agents/client.js's RPC call path (_callImpl) calls
// crypto.randomUUID() directly with no fallback, throwing "undefined is not
// a function" on every single RPC call. Standard RFC 4122 v4 UUID via
// getRandomValues, same algorithm partysocket's own fallback uses.
if (typeof globalThis.crypto?.randomUUID !== "function") {
	globalThis.crypto.randomUUID = () => {
		const bytes = new Uint8Array(16);
		globalThis.crypto.getRandomValues(bytes);
		bytes[6] = (bytes[6] & 0x0f) | 0x40;
		bytes[8] = (bytes[8] & 0x3f) | 0x80;
		const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
		return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` as ReturnType<Crypto["randomUUID"]>;
	};
}

// Hermes provides EventTarget/Event natively but not MessageEvent, which
// partysocket's React Native code path (partysocket/dist/ws.js's
// cloneEventNode, used because it detects navigator.product === "ReactNative")
// constructs directly for every incoming WebSocket message.
if (typeof globalThis.MessageEvent === "undefined") {
	class MessageEventPolyfill extends Event {
		data: unknown;
		constructor(type: string, eventInitDict?: { data?: unknown } & EventInit) {
			super(type, eventInitDict);
			this.data = eventInitDict?.data;
		}
	}
	// @ts-expect-error - assigning a polyfill onto the global scope.
	globalThis.MessageEvent = MessageEventPolyfill;
}
