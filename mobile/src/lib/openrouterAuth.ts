import * as WebBrowser from "expo-web-browser";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

// No backend at all anymore - PKCE needs no client secret, so the
// authorize -> code -> key exchange happens entirely on-device. The
// resulting key draws from whichever OpenRouter account authorizes it (see
// the settings screen), so this is a one-time setup per device, not per
// list.
const APP_REDIRECT_URL = "grocy://auth-callback";

// OpenRouter's callback_url only accepts https:// (or localhost) - it
// silently ignores the OAuth request and just shows the normal logged-in
// dashboard if given a bare custom scheme, with no error. This page (see
// the site/ directory at the repo root) does the same job a third-party
// redirect service was doing before: it's the https "middleman" OpenRouter
// needs, which then hands off to the app's own grocy:// scheme - normally
// intercepted directly by the auth session below before this page even
// finishes loading, with a client-side redirect as a fallback.
const OAUTH_CALLBACK_URL = "https://grocy-site.pages.dev/auth-callback";

const KEY_STORE_KEY = "grocy-openrouter-key";

function base64UrlEncode(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createCodeChallenge(verifier: string): Promise<string> {
	const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
		encoding: Crypto.CryptoEncoding.BASE64,
	});
	return digest.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function connectOpenRouter(): Promise<void> {
	const verifierBytes = await Crypto.getRandomBytesAsync(32);
	const codeVerifier = base64UrlEncode(verifierBytes);
	const codeChallenge = await createCodeChallenge(codeVerifier);

	const authorizeUrl = `https://openrouter.ai/auth?callback_url=${encodeURIComponent(OAUTH_CALLBACK_URL)}&code_challenge=${codeChallenge}&code_challenge_method=S256`;

	const result = await WebBrowser.openAuthSessionAsync(authorizeUrl, APP_REDIRECT_URL);
	if (result.type !== "success" || !result.url) {
		throw new Error("OpenRouter authorization was cancelled or failed.");
	}

	const code = new URL(result.url).searchParams.get("code");
	if (!code) throw new Error("No authorization code returned by OpenRouter.");

	const response = await fetch("https://openrouter.ai/api/v1/auth/keys", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ code, code_verifier: codeVerifier, code_challenge_method: "S256" }),
	});

	if (!response.ok) {
		throw new Error(`OpenRouter key exchange failed: ${response.status} ${await response.text()}`);
	}

	const { key } = (await response.json()) as { key: string };
	await SecureStore.setItemAsync(KEY_STORE_KEY, key);
}

export async function getOpenRouterKey(): Promise<string | null> {
	return SecureStore.getItemAsync(KEY_STORE_KEY);
}

export async function disconnectOpenRouter(): Promise<void> {
	await SecureStore.deleteItemAsync(KEY_STORE_KEY);
}
