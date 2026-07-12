import { nanoid } from "nanoid";
import type { CategoryId } from "../../shared/categories";
import type { ListItem, SharedList } from "../../shared/types";

export async function finalizeList(db: D1Database, transcript: string, items: ListItem[]): Promise<string> {
	const slug = nanoid(10);
	const now = Date.now();

	const statements = [
		db.prepare("INSERT INTO lists (id, created_at, transcript) VALUES (?, ?, ?)").bind(slug, now, transcript),
		...items.map((item, index) =>
			db
				.prepare(
					"INSERT INTO items (id, list_id, name, quantity, category, ticked, sort_order, estimated_price) VALUES (?, ?, ?, ?, ?, 0, ?, ?)",
				)
				.bind(nanoid(8), slug, item.name, item.quantity, item.category, index, item.estimatedPrice),
		),
	];

	await db.batch(statements);
	return slug;
}

type ListRow = { id: string; created_at: number };
type ItemRow = {
	id: string;
	name: string;
	quantity: string;
	category: string;
	ticked: number;
	sort_order: number;
	estimated_price: number | null;
};

export async function getList(db: D1Database, slug: string): Promise<SharedList | null> {
	const list = await db.prepare("SELECT id, created_at FROM lists WHERE id = ?").bind(slug).first<ListRow>();
	if (!list) return null;

	const { results } = await db
		.prepare(
			"SELECT id, name, quantity, category, ticked, sort_order, estimated_price FROM items WHERE list_id = ? ORDER BY sort_order",
		)
		.bind(slug)
		.all<ItemRow>();

	return {
		id: list.id,
		createdAt: list.created_at,
		items: results.map((row) => ({
			id: row.id,
			name: row.name,
			quantity: row.quantity,
			category: row.category as CategoryId,
			ticked: row.ticked === 1,
			estimatedPrice: row.estimated_price,
		})),
	};
}

export async function setItemTicked(db: D1Database, slug: string, itemId: string, ticked: boolean): Promise<boolean> {
	const result = await db
		.prepare("UPDATE items SET ticked = ? WHERE id = ? AND list_id = ?")
		.bind(ticked ? 1 : 0, itemId, slug)
		.run();
	return (result.meta.changes ?? 0) > 0;
}

type FrequentItemRow = { name: string; quantity: string };

// Exact-name grouping, not fuzzy matching - if the same item gets
// transcribed slightly differently between trips it'll be counted
// separately. Acceptable for a household with consistent speech patterns;
// not worth a real dedup system for two users.
export async function getFrequentItems(db: D1Database, limit = 8): Promise<FrequentItemRow[]> {
	const { results } = await db
		.prepare(
			`SELECT name, quantity FROM (
				SELECT
					i.name AS name,
					i.quantity AS quantity,
					COUNT(*) OVER (PARTITION BY i.name) AS freq,
					ROW_NUMBER() OVER (PARTITION BY i.name ORDER BY l.created_at DESC) AS rn
				FROM items i
				JOIN lists l ON i.list_id = l.id
			)
			WHERE rn = 1
			ORDER BY freq DESC
			LIMIT ?`,
		)
		.bind(limit)
		.all<FrequentItemRow>();
	return results;
}
