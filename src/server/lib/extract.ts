import { CATEGORY_IDS, type CategoryId } from "../../shared/categories";
import type { ListItem } from "../../shared/types";

const ITEMS_SCHEMA = {
	type: "object",
	properties: {
		items: {
			type: "array",
			items: {
				type: "object",
				properties: {
					name: { type: "string" },
					quantity: { type: "string" },
					category: { type: "string", enum: CATEGORY_IDS },
				},
				required: ["name", "quantity", "category"],
			},
		},
	},
	required: ["items"],
};

const SYSTEM_PROMPT =
	"You read a running Tamil speech transcript of a grocery list someone is dictating out loud, " +
	"sometimes mixed with English words (brand names, loanwords). Extract the current, de-duplicated " +
	"set of grocery items mentioned so far.\n\n" +
	"The transcript is cumulative and may include corrections spoken later, such as \"தக்காளி இல்ல, " +
	'ஒரு கிலோ போதும்" (never mind, one kg is enough), "வெங்காயத்த இரண்டு கிலோவா மாத்து" (change onion to ' +
	'two kg), or simply repeating the item with a new quantity. When that happens, treat it as an update ' +
	"to the SAME item, not a new one: keep a single entry for that item with its latest quantity. Only " +
	"treat two mentions as separate items if they are clearly different products.\n\n" +
	"Example - transcript so far: \"தக்காளி இரண்டு கிலோ. வெங்காயம் ஒரு கிலோ. தக்காளியை ஒரு கிலோவா மாத்து.\" " +
	'(tomato 2kg. onion 1kg. change tomato to 1kg.) -> items: [{"name": "தக்காளி", "quantity": "1 கிலோ", ' +
	'"category": "vegetables"}, {"name": "வெங்காயம்", "quantity": "1 கிலோ", "category": "vegetables"}] ' +
	"- note tomato appears only once, with the corrected quantity.\n\n" +
	'Keep item names in Tamil as spoken. Quantity is free text such as "1 kg", "2 dozen", "அரை கிலோ" - ' +
	'if no quantity was said, use "1". ' +
	`Assign each item to exactly one category id from this fixed list: ${CATEGORY_IDS.join(", ")}. ` +
	"Respond with JSON only, matching the given schema.";

export async function extractItems(ai: Ai, transcript: string): Promise<ListItem[]> {
	if (!transcript.trim()) return [];

	const messages = [
		{ role: "system", content: SYSTEM_PROMPT },
		{ role: "user", content: transcript },
	];

	const result = await ai.run(
		"@cf/meta/llama-3.3-70b-instruct-fp8-fast",
		{
			messages,
			response_format: { type: "json_schema", json_schema: ITEMS_SCHEMA },
		} as Parameters<Ai["run"]>[1],
	);

	const rawItems = parseItemsResponse(result);

	return rawItems.map((item, index) => ({
		id: `item-${index}`,
		name: String(item.name ?? "").trim(),
		quantity: String(item.quantity ?? "1").trim() || "1",
		category: isCategoryId(item.category) ? item.category : "other",
	}));
}

function parseItemsResponse(result: unknown): Array<{ name?: unknown; quantity?: unknown; category?: unknown }> {
	const responseField = (result as { response?: unknown })?.response ?? result;
	const parsed = typeof responseField === "string" ? safeJsonParse(responseField) : responseField;
	const items = (parsed as { items?: unknown })?.items;
	return Array.isArray(items) ? items : [];
}

function safeJsonParse(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return {};
	}
}

function isCategoryId(value: unknown): value is CategoryId {
	return typeof value === "string" && (CATEGORY_IDS as string[]).includes(value);
}
