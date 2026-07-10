// Deliberately does no caching. The app's core features (live transcription,
// the WebSocket-synced list, sharing) all need a live connection anyway, so
// there's nothing meaningful to serve offline - this service worker exists
// only because installable/TWA checks expect one to be registered.
self.addEventListener("fetch", () => {});
