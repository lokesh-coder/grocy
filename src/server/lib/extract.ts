import { CATEGORY_IDS, type CategoryId } from "../../shared/categories";
import type { ListItem } from "../../shared/types";

// The extraction model is a plain config value (not hardcoded), so swapping
// to a different model later is a one-line change here or in wrangler.jsonc,
// not a rewrite. "~google/gemini-pro-latest" is OpenRouter's own alias for
// whatever the current best Gemini Pro model is, so it stays current as
// Google ships new versions without us needing to track exact version names.
const DEFAULT_MODEL = "~google/gemini-pro-latest";

// Gemini's default ("max") reasoning depth measured 4-15s of wildly variable
// latency for even a single simple item - it decides how much to think per
// request with no real ceiling. "low" cut reasoning tokens by ~75% (and cost
// similarly) while still handling the hard cases correctly (full item
// replacement, quantity-vs-price disambiguation) across repeated tests, and
// tightened latency to a consistent ~5-7s instead of an unpredictable range -
// the inconsistency itself was as much the complaint as the raw speed.
const DEFAULT_REASONING_EFFORT = "low";

const SYSTEM_PROMPT = `You read a running Tamil speech transcript of a grocery list someone is dictating out loud, sometimes mixed with English words (brand names, loanwords). People think out loud while doing this: they pause, restart, correct themselves, change their mind about an item entirely, or fix a quantity. Extract the current, de-duplicated set of grocery items the person currently wants - not just what they said, but what they mean after accounting for every correction and replacement.

Rules:
- If a later mention corrects an earlier one (same item, new quantity), keep only the latest quantity for that item.
- If a later mention replaces an earlier item entirely (the person explicitly says they don't want it anymore, e.g. "இல்ல அது வேண்டாம்", "வேணாம்", "மாத்திடு"), remove the earlier item completely - do not keep both.
- If a quantity phrase includes a price as well as a count (e.g. "பத்து பாக்கெட், ஒவ்வொன்றும் இருபது ரூபாய்" = ten packets, twenty rupees each), keep the count as the primary quantity and note the price alongside it (e.g. "10 பாக்கெட் (₹20/பாக்கெட்)") - don't confuse the price for a second, different quantity.
- Ignore filler words, hesitations, and false starts ("ம்ம்", "பாரு", "இல்ல... இல்ல") - they're not items.
- Keep item names in Tamil exactly as spoken.
- If no quantity was mentioned for an item, use exactly "1" as its quantity - never leave it blank or write "not specified".
- Assign each item to exactly one category id from this fixed list: ${CATEGORY_IDS.join(", ")}.
- Only include items the person currently wants - never something explicitly replaced or cancelled. If nothing has been said yet, return an empty list.`;

const ITEMS_SCHEMA = {
	name: "grocery_items",
	strict: true,
	schema: {
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
					additionalProperties: false,
				},
			},
		},
		required: ["items"],
		additionalProperties: false,
	},
};

type ExtractEnv = {
	OPENROUTER_API_KEY: string;
	EXTRACTION_MODEL?: string;
	EXTRACTION_REASONING_EFFORT?: string;
};

export async function extractItems(env: ExtractEnv, transcript: string): Promise<ListItem[]> {
	if (!transcript.trim()) return [];

	const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model: env.EXTRACTION_MODEL || DEFAULT_MODEL,
			max_tokens: 3000,
			reasoning: { effort: env.EXTRACTION_REASONING_EFFORT || DEFAULT_REASONING_EFFORT },
			messages: [
				{ role: "system", content: SYSTEM_PROMPT },
				{ role: "user", content: transcript },
			],
			response_format: { type: "json_schema", json_schema: ITEMS_SCHEMA },
		}),
	});

	if (!response.ok) {
		throw new Error(`OpenRouter request failed: ${response.status} ${await response.text()}`);
	}

	const result = await response.json();
	const rawItems = parseItemsResponse(result);

	return rawItems.map((item, index) => ({
		id: `item-${index}`,
		name: String(item.name ?? "").trim(),
		quantity: String(item.quantity ?? "1").trim() || "1",
		category: isCategoryId(item.category) ? item.category : "other",
	}));
}

function parseItemsResponse(result: unknown): Array<{ name?: unknown; quantity?: unknown; category?: unknown }> {
	const content = (result as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message
		?.content;
	const parsed = typeof content === "string" ? safeJsonParse(content) : content;
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
