import { routeAgentRequest } from "agents";
import { Hono } from "hono";
import { categorizeItems, estimatePrices } from "./lib/extract";
import { deleteListItem, getFrequentItems, getList, saveOrganizedItems, setItemTicked } from "./lib/db";

export { ListSessionAgent } from "./agents/list-session";

const app = new Hono<{ Bindings: Env }>();

// Android Digital Asset Links - lets the OS verify that this app is
// authorized to open https://grocy.notesane.workers.dev/list/:slug links
// directly instead of falling back to a browser (App Links). The
// fingerprint is the release keystore's cert SHA-256 (see
// mobile/keystores/README.md) - would need updating here if that keystore
// is ever rotated.
app.get("/.well-known/assetlinks.json", (c) =>
	c.json([
		{
			relation: ["delegate_permission/common.handle_all_urls"],
			target: {
				namespace: "android_app",
				package_name: "com.anonymous.mobile",
				sha256_cert_fingerprints: ["FF:5C:D5:5C:58:83:85:16:D5:36:4E:69:C8:DC:C5:CE:C5:84:B0:6D:AD:E0:F8:BC:78:5F:19:35:D8:50:E8:DF"],
			},
		},
	]),
);

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

app.delete("/api/list/:slug/item/:itemId", async (c) => {
	const { slug, itemId } = c.req.param();
	const ok = await deleteListItem(c.env.DB, slug, itemId);
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
