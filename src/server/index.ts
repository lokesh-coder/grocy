import { Hono } from "hono";
import { categorizeItems, estimatePrices, extractItems } from "./lib/extract";
import type { DraftItem } from "../shared/types";

// Fully stateless: no shared/live list, so nothing is persisted server-side.
// This exists only to keep the OpenRouter API key off the device - every
// route is a plain request/response over the transcript or items the client
// already has locally.
const app = new Hono<{ Bindings: Env }>();

app.post("/api/extract", async (c) => {
	const { transcript } = await c.req.json<{ transcript: string }>();
	const items = await extractItems(c.env, transcript);
	return c.json({ items });
});

// Optional, on-demand from the client (kept as a separate call, not folded
// into /api/extract, so Done stays fast and this only runs if someone
// actually taps "Organize").
app.post("/api/organize", async (c) => {
	const { items } = await c.req.json<{ items: DraftItem[] }>();
	const categorized = await categorizeItems(c.env, items);
	const priced = await estimatePrices(c.env, categorized);
	return c.json({ items: priced });
});

export default app satisfies ExportedHandler<Env>;
