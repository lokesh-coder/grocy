import { Hono } from "hono";

// The only backend Grocy has. Its one job: hold the OpenRouter Management
// (provisioning) key as a secret and mint a small, capped, auto-renewing
// key for a fresh install - so a new user gets working extraction
// immediately, with no OpenRouter signup required, before ever choosing to
// connect their own account (see mobile/src/lib/openrouterAuth.ts). Once
// minted, the app talks to OpenRouter directly with that key forever after
// - this endpoint is never touched again for that install unless a second
// key is needed (e.g. after a fresh install/reconnect).
//
// Still deliberately unauthenticated (no login, no Turnstile) - the small
// per-key spending limit keeps a single mint cheap. What it no longer
// tolerates is the same device farming unlimited free budgets by
// uninstalling and reinstalling: the client sends a hash of its Android ID
// (stable across reinstalls of this signed app, unlike the on-device
// SecureStore key - see openrouterAuth.ts), and PROVISIONED_KEYS remembers
// which device already has a key. A repeat request for a known device gets
// its existing key back instead of a fresh budget.
const FREE_LIMIT_USD = 0.5;

const app = new Hono<{ Bindings: Env }>();

app.post("/provision-key", async (c) => {
	const body = await c.req.json<{ deviceId?: unknown }>().catch(() => ({}) as { deviceId?: unknown });
	const deviceId = typeof body.deviceId === "string" && body.deviceId ? body.deviceId : null;

	if (deviceId) {
		const existingKey = await c.env.PROVISIONED_KEYS.get(deviceId);
		if (existingKey) return c.json({ key: existingKey });
	}

	const response = await fetch("https://openrouter.ai/api/v1/keys", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${c.env.OPENROUTER_PROVISIONING_KEY}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			name: `grocy-auto-${crypto.randomUUID().slice(0, 8)}`,
			limit: FREE_LIMIT_USD,
			limit_reset: "monthly",
		}),
	});

	if (!response.ok) {
		return c.json({ error: `Provisioning failed: ${response.status} ${await response.text()}` }, 502);
	}

	const result = (await response.json()) as Record<string, unknown>;
	// OpenRouter's create-key response shape isn't fully nailed down from
	// docs alone (they mix in the list-endpoint shape in places) - check the
	// plausible spots for the actual usable key string rather than assuming
	// one, and fail loudly with the raw body if none match so this is easy
	// to fix from a live log instead of guessing again.
	const data = result.data as Record<string, unknown> | undefined;
	const key = (result.key ?? data?.key) as string | undefined;

	if (!key) {
		return c.json({ error: "Unexpected provisioning response shape", raw: result }, 502);
	}

	// No device id (non-Android, or the client couldn't read one) just skips
	// memoization - it mints every time, same as before this change.
	if (deviceId) await c.env.PROVISIONED_KEYS.put(deviceId, key);

	return c.json({ key });
});

export default app satisfies ExportedHandler<Env>;
