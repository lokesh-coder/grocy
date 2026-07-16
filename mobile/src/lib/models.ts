// Curated so the settings screen is a short pick-one list, not a free-text
// field - the backend enforces the same allowlist server-side (see
// src/server/index.ts) since the request goes through with our API key.
export type ModelOption = { id: string; label: string; description: string };

export const MODEL_OPTIONS: ModelOption[] = [
	{ id: "~google/gemini-pro-latest", label: "Gemini Pro", description: "இயல்பு · மிகச் சரியானது, மெதுவானது" },
	{ id: "~google/gemini-flash-latest", label: "Gemini Flash", description: "வேகமானது" },
	{ id: "google/gemini-2.5-flash-lite", label: "Gemini Flash Lite", description: "மிக வேகமானது" },
];

export const DEFAULT_MODEL_ID = MODEL_OPTIONS[0].id;
