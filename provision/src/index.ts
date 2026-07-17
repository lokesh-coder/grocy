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
// Deliberately unauthenticated - the small per-key spending limit bounds
// the worst case (someone farming free keys by reinstalling costs at most
// FREE_LIMIT_USD per key, not unlimited exposure). Revisit with rate
// limiting or Turnstile if that ever becomes a real problem in practice.
const FREE_LIMIT_USD = 0.5;

const app = new Hono<{ Bindings: Env }>();

app.post("/provision-key", async (c) => {
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

	return c.json({ key });
});

export default app satisfies ExportedHandler<Env>;
