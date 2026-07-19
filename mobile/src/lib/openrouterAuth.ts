import * as WebBrowser from "expo-web-browser";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as Application from "expo-application";
import { Platform } from "react-native";

// PKCE needs no client secret, so the authorize -> code -> key exchange
// happens entirely on-device. The resulting key draws from whichever
// OpenRouter account authorizes it (see the settings screen), so this is a
// one-time setup per device, not per list.
const APP_REDIRECT_URL = "grocy://auth-callback";

// OpenRouter's callback_url only accepts https:// (or localhost) - it
// silently ignores the OAuth request and just shows the normal logged-in
// dashboard if given a bare custom scheme, with no error. This page (see
// the site/ directory at the repo root) does the same job a third-party
// redirect service was doing before: it's the https "middleman" OpenRouter
// needs, which then hands off to the app's own grocy:// scheme - normally
// intercepted directly by the auth session below before this page even
// finishes loading, with a client-side redirect as a fallback.
const OAUTH_CALLBACK_URL = "https://grocy.store/auth-callback";

// The one backend Grocy has (see provision/src/index.ts) - mints a small,
// free, auto-renewing OpenRouter key so a fresh install works immediately
// without requiring an OpenRouter account first. Only ever called once per
// install, when no key exists yet - after that the app talks to OpenRouter
// directly with whatever key it has stored.
const PROVISION_URL = "https://provision.grocy.store/provision-key";

const KEY_STORE_KEY = "grocy-openrouter-key";
const IS_AUTO_KEY_STORE_KEY = "grocy-openrouter-key-is-auto";

// Android ID (unlike the SecureStore key above) is tied to the device +
// signing key + user profile, not app-private storage - it survives an
// uninstall/reinstall of this same signed app. Sent to the provisioning
// Worker so it can recognize "this device already has a free key" and hand
// back the same one instead of minting a new $0.50/month budget every time
// someone reinstalls (see provision/src/index.ts). Hashed before it ever
// leaves the device - the Worker only needs to compare it, never the raw ID.
async function getHashedDeviceId(): Promise<string | null> {
	if (Platform.OS !== "android") return null;
	const androidId = Application.getAndroidId();
	if (!androidId) return null;
	return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, androidId, { encoding: Crypto.CryptoEncoding.HEX });
}

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

// Explicit user action from Settings - connecting a real OpenRouter account
// replaces whatever auto-provisioned key was there (if any) with an
// unlimited one the user controls and pays for themselves.
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
	await SecureStore.setItemAsync(IS_AUTO_KEY_STORE_KEY, "false");
}

export async function getOpenRouterKey(): Promise<string | null> {
	return SecureStore.getItemAsync(KEY_STORE_KEY);
}

export async function isAutoProvisionedKey(): Promise<boolean> {
	return (await SecureStore.getItemAsync(IS_AUTO_KEY_STORE_KEY)) === "true";
}

// Called from extract.ts before every extraction/organize call, not just
// once at connect time - so the very first "Done" tap on a fresh install
// works with no setup at all. Only actually hits the network the first
// time (or after a disconnect); every call after that just returns the
// already-stored key.
export async function ensureOpenRouterKey(): Promise<string | null> {
	const existing = await getOpenRouterKey();
	if (existing) return existing;

	try {
		const deviceId = await getHashedDeviceId();
		const response = await fetch(PROVISION_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ deviceId }),
		});
		if (!response.ok) return null;
		const { key } = (await response.json()) as { key: string };
		if (!key) return null;
		await SecureStore.setItemAsync(KEY_STORE_KEY, key);
		await SecureStore.setItemAsync(IS_AUTO_KEY_STORE_KEY, "true");
		return key;
	} catch {
		// No network, provisioning endpoint down, etc. - extract.ts surfaces
		// this as "connect your own account" rather than a silent failure.
		return null;
	}
}

export async function disconnectOpenRouter(): Promise<void> {
	await SecureStore.deleteItemAsync(KEY_STORE_KEY);
	await SecureStore.deleteItemAsync(IS_AUTO_KEY_STORE_KEY);
}

export type KeyUsage = {
	// All amounts are USD - OpenRouter's real billing currency, distinct from
	// the ₹ grocery-price estimates shown elsewhere in the app (see
	// extract.ts's estimatePrices) - the Usage screen labels this explicitly
	// so it doesn't read as a currency mismatch.
	usage: number;
	// null means unlimited (a connected personal account, not the capped
	// auto-provisioned free tier - see provision/src/index.ts's FREE_LIMIT_USD).
	limit: number | null;
	limitRemaining: number | null;
	limitReset: string | null;
	isFreeTier: boolean;
};

// Powers the Settings > Usage page - a plain read against OpenRouter's own
// key-info endpoint using whatever key is already stored, auto-provisioned
// or the user's own. Returns null when there's no key to ask about yet
// (never triggers auto-provisioning itself - that only happens from an
// actual extraction call, see ensureOpenRouterKey).
export async function getKeyUsage(): Promise<KeyUsage | null> {
	const key = await getOpenRouterKey();
	if (!key) return null;

	const response = await fetch("https://openrouter.ai/api/v1/key", {
		headers: { Authorization: `Bearer ${key}` },
	});
	if (!response.ok) return null;

	const { data } = (await response.json()) as {
		data: {
			usage: number;
			limit: number | null;
			limit_remaining: number | null;
			limit_reset: string | null;
			is_free_tier: boolean;
		};
	};

	return {
		usage: data.usage,
		limit: data.limit,
		limitRemaining: data.limit_remaining,
		limitReset: data.limit_reset,
		isFreeTier: data.is_free_tier,
	};
}
