import { routeAgentRequest } from "agents";
import { Hono } from "hono";
import { categorizeItems, estimatePrices } from "./lib/extract";
import { getFrequentItems, getList, saveOrganizedItems, setItemTicked } from "./lib/db";

export { ListSessionAgent } from "./agents/list-session";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/frequent-items", async (c) => {
	const items = await getFrequentItems(c.env.DB);
	return c.json({ items });
});

app.get("/api/list/:slug", async (c) => {
	const list = await getList(c.env.DB, c.req.param("slug"));
	if (!list) return c.json({ error: "List not found" }, 404);
	return c.json(list);
});

// Categorizing and pricing were moved out of finalize() so "Done" stays
// fast - this is where that work actually happens, triggered on demand from
// the shared list page rather than automatically, so it only runs when
// someone's actually about to shop.
app.post("/api/list/:slug/organize", async (c) => {
	const slug = c.req.param("slug");
	const list = await getList(c.env.DB, slug);
	if (!list) return c.json({ error: "List not found" }, 404);

	if (!list.organized) {
		const draftItems = list.items.map((item) => ({ id: item.id, name: item.name, quantity: item.quantity }));
		const categorized = await categorizeItems(c.env, draftItems);
		const priced = await estimatePrices(c.env, categorized);
		await saveOrganizedItems(c.env.DB, slug, priced);
	}

	const updated = await getList(c.env.DB, slug);
	return c.json(updated);
});

app.patch("/api/list/:slug/item/:itemId", async (c) => {
	const { slug, itemId } = c.req.param();
	const body = await c.req.json<{ ticked: boolean }>();
	const ok = await setItemTicked(c.env.DB, slug, itemId, Boolean(body.ticked));
	if (!ok) return c.json({ error: "Item not found" }, 404);
	return c.json({ ok: true });
});

export default {
	async fetch(request, env, ctx) {
		const agentResponse = await routeAgentRequest(request, env);
		if (agentResponse) return agentResponse;

		return app.fetch(request, env, ctx);
	},
} satisfies ExportedHandler<Env>;
