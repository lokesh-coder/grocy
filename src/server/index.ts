import { routeAgentRequest } from "agents";
import { Hono } from "hono";
import { getFrequentItems, getList, setItemTicked } from "./lib/db";

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
