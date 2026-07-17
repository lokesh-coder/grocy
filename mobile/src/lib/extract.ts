// Ported from the old Cloudflare Worker's src/server/lib/extract.ts - same
// prompts/schemas/reasoning effort, now calling OpenRouter directly with the
// user's own key (see openrouterAuth.ts) instead of routing through a
// backend that existed only to hide a shared key. Keep this in sync with
// that file if it still exists, or treat this as the sole copy once it's
// been removed.
import { CATEGORY_IDS, type CategoryId } from "../shared/categories";
import type { DraftItem, ListItem } from "../shared/types";
import { ensureOpenRouterKey } from "./openrouterAuth";
import { getCustomInstructions } from "./customInstructions";

const REASONING_EFFORT = "low";

// Thrown when there's no key at all and auto-provisioning also failed (no
// network, provisioning endpoint down) - distinct from the limit-exceeded
// case below so the UI can word the prompt correctly either way.
export class OpenRouterNotConnectedError extends Error {
	constructor() {
		super("Not connected to OpenRouter, and a free key couldn't be provisioned automatically.");
		this.name = "OpenRouterNotConnectedError";
	}
}

// Thrown when the stored key (usually an auto-provisioned free one) has hit
// its spending limit - OpenRouter returns 402 for this.
export class OpenRouterLimitExceededError extends Error {
	constructor() {
		super("This OpenRouter key has reached its usage limit.");
		this.name = "OpenRouterLimitExceededError";
	}
}

const SYSTEM_PROMPT = `You read a running Tamil speech transcript of a grocery list someone is dictating out loud, sometimes mixed with English words (brand names, loanwords). People think out loud while doing this: they pause, restart, correct themselves, change their mind about an item entirely, or fix a quantity. Extract the current, de-duplicated set of grocery items the person currently wants - not just what they said, but what they mean after accounting for every correction and replacement.

Think like an attentive person standing next to them, jotting the list down by ear - use real-world grocery knowledge to fill in what's implied, not just what's literally spoken.

Rules:
- If a later mention corrects an earlier one (same item, new quantity), keep only the latest quantity for that item.
- If a later mention replaces an earlier item entirely (the person explicitly says they don't want it anymore, e.g. "இல்ல அது வேண்டாம்", "வேணாம்", "மாத்திடு"), remove the earlier item completely - do not keep both.
- A bare number with no unit takes its unit from how that item is actually sold: liquids (பால், எண்ணெய், தண்ணீர்) are normally mL or L, solids sold loose or by weight (காய்கறி, மசாலா, அரிசி) are normally g or kg. Judge which by realistic everyday package sizes for that specific item - e.g. "100" for oil is far more likely 100 mL than 100 kg.
- If a quantity is stated purely as an amount of money with no count or weight (e.g. "கறிவேப்பிலை பத்து ரூபாய்க்கு" = curry leaves for ten rupees), record it as that amount (e.g. "₹10") rather than inventing a weight or count that was never said.
- If a quantity phrase includes a price as well as a count (e.g. "பத்து பாக்கெட், ஒவ்வொன்றும் இருபது ரூபாய்" = ten packets, twenty rupees each, or "நான்கு பாக்கெட் ஒரு ரூபாய்" = four one-rupee packets), keep the count as the primary quantity and note the price alongside it (e.g. "10 பாக்கெட் (₹20/பாக்கெட்)") - don't confuse the price for a second, different quantity.
- If one price is said to cover several different items together (e.g. "இவ இரண்டுக்கும் சேர்ந்து முப்பது ரூபாய்" = thirty rupees combined for both of these), don't drop that price - note it on each of those items (e.g. "அரை டசன் (மொத்தம் ₹30 இரண்டுக்கும்)").
- Always write counts using Arabic numerals, never spelled-out number words - "இரண்டு", "ரெண்டு", and "மூணு" all become "2" and "3", not the Tamil words themselves.
- Write units as standard English abbreviations, not Tamil words: கிலோ becomes "kg", லிட்டர் becomes "Lit", கிராம் becomes "g", மில்லி becomes "ml". Spoken fractions become numeric fractions the same way - அரை (half) becomes "1/2", கால் (quarter) becomes "1/4", முக்கால் (three-quarter) becomes "3/4" - e.g. "அரை கிலோ" becomes "1/2 kg", not "half kg" or "அரை kg".
- Flowers and garlands are sometimes measured in முழம் (a traditional arm-length unit) - there's no standard English equivalent for it, so keep it as "mulam" (e.g. "2 mulam").
- If one quantity is said to apply to several items together (e.g. "தக்காளி வெங்காயம் ஒவ்வொண்ணும் ஒரு கிலோ" = tomato and onion, one kg each), apply that quantity to each item individually, not split between them - unless the person clearly means a combined/mixed amount.
- Vague quantities ("கொஞ்சம்", "கொஞ்சம் அதிகமா", "இன்னும் கொஞ்சம்") are a real answer, not a missing one - keep them as spoken (e.g. "கொஞ்சம்") instead of inventing a number or unit for them.
- Ignore filler words, hesitations, and false starts ("ம்ம்", "பாரு", "இல்ல... இல்ல") - they're not items.
- Keep item names in Tamil exactly as spoken - except when a name is really a Tamil-script phonetic spelling of an English word or brand name (e.g. "எஸ் வி எஸ்" = "SVS", "ஹார்லிக்ஸ்" = "Horlicks", "டைப்பர்" = "Diaper"). Speech recognition transliterates English words into Tamil script since it's listening in Tamil, but these are conventionally written in English - write them that way instead of the Tamil transliteration.
- If no quantity was mentioned at all for an item, use exactly "1" as its quantity - never leave it blank or write "not specified".
- Only include items the person currently wants - never something explicitly replaced or cancelled. If nothing has been said yet, return an empty list.
- Set needsConfirmation to true whenever you had to guess rather than parse something the person actually said clearly: a vague quantity ("கொஞ்சம்"), an item name you're not confident you heard correctly, or a bare number where you inferred the unit from real-world knowledge rather than it being spoken. Set it to false when the item and quantity were stated plainly. Never silently guess without flagging it - a wrong flagged guess is fine, a wrong silent one isn't.

Common Tamil Nadu grocery brand names, in case speech recognition garbles them - use these spellings whenever the transcript is a plausible phonetic match, even if the letters look quite different:
Dairy: Aavin, Arokya, Hatsun, Milky Mist. Oils: Gold Winner, Idhayam, Fortune, Sunpure, VVD. Ghee: RKG, GRB, Aavin. Masala: Sakthi, Aachi, MTR, Everest. Tea/Coffee: 3 Roses, AVT, Chakra Gold, Bru, Nescafe, Narasus. Rice/Atta: India Gate, Aashirvaad. Dal: Udhaiyam. Semiya/Rava: Anil, Bambino. Biscuits/Snacks: Parle-G, Milk Bikis, Marie Gold, Hide & Seek. Cleaning: Surf Excel, Rin, Ponvandu, Vim, Harpic, Lizol. Personal care: Hamam, Mysore Sandal, Ponds, Cinthol, Meera, Chik.
Note: "Ponni", "பச்சரிசி", "புழுங்கல் அரிசி", "இட்லி அரிசி" are rice varieties, not brands - keep them as said, don't replace with a brand from the list above.`;

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
						needsConfirmation: { type: "boolean" },
					},
					required: ["name", "quantity", "needsConfirmation"],
					additionalProperties: false,
				},
			},
		},
		required: ["items"],
		additionalProperties: false,
	},
};

const CATEGORIZE_SYSTEM_PROMPT = `You classify grocery items into store categories. You'll get a numbered list of grocery item names (Tamil, sometimes mixed with English). For each numbered item, assign exactly one category id from this fixed list: ${CATEGORY_IDS.join(", ")}. Do not change, translate, or reinterpret the item names - only classify them. Return one entry per input index.`;

const CATEGORIZE_SCHEMA = {
	name: "item_categories",
	strict: true,
	schema: {
		type: "object",
		properties: {
			categories: {
				type: "array",
				items: {
					type: "object",
					properties: {
						index: { type: "integer" },
						category: { type: "string", enum: CATEGORY_IDS },
					},
					required: ["index", "category"],
					additionalProperties: false,
				},
			},
		},
		required: ["categories"],
		additionalProperties: false,
	},
};

const PRICE_SYSTEM_PROMPT = `You estimate current Indian grocery prices. You'll get a numbered list of grocery items (name and quantity, Tamil sometimes mixed with English) being bought in Tamil Nadu, India. For each item, search current Indian grocery/quick-commerce listings (BigBasket, Zepto, Blinkit, and similar) and give a single reasonable approximate price in rupees for that exact quantity - a point estimate, not a range. If you have no reasonable basis to estimate a specific item, omit it entirely rather than guessing wildly.`;

const PRICE_SCHEMA = {
	name: "item_prices",
	strict: true,
	schema: {
		type: "object",
		properties: {
			prices: {
				type: "array",
				items: {
					type: "object",
					properties: {
						index: { type: "integer" },
						price_rupees: { type: "number" },
					},
					required: ["index", "price_rupees"],
					additionalProperties: false,
				},
			},
		},
		required: ["prices"],
		additionalProperties: false,
	},
};

async function chatCompletion(model: string, maxTokens: number, systemPrompt: string, userContent: string, schema: unknown) {
	const key = await ensureOpenRouterKey();
	if (!key) throw new OpenRouterNotConnectedError();

	const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${key}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model,
			max_tokens: maxTokens,
			reasoning: { effort: REASONING_EFFORT },
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: userContent },
			],
			response_format: { type: "json_schema", json_schema: schema },
		}),
	});

	if (response.status === 402) {
		throw new OpenRouterLimitExceededError();
	}
	if (!response.ok) {
		throw new Error(`OpenRouter request failed: ${response.status} ${await response.text()}`);
	}

	return response.json();
}

export async function extractItems(transcript: string, model: string): Promise<DraftItem[]> {
	if (!transcript.trim()) return [];

	const custom = await getCustomInstructions();
	const systemPrompt = custom
		? `${SYSTEM_PROMPT}\n\nThe user has also given you these additional standing instructions - follow them too, alongside everything above:\n${custom}`
		: SYSTEM_PROMPT;

	const result = await chatCompletion(model, 3000, systemPrompt, transcript, ITEMS_SCHEMA);
	const rawItems = parseItemsResponse(result);

	return rawItems.map((item, index) => ({
		id: `item-${index}`,
		name: String(item.name ?? "").trim(),
		quantity: String(item.quantity ?? "1").trim() || "1",
		needsConfirmation: Boolean(item.needsConfirmation),
	}));
}

export async function categorizeItems(items: DraftItem[], model: string): Promise<ListItem[]> {
	if (items.length === 0) return [];

	const numberedList = items.map((item, index) => `${index}. ${item.name}`).join("\n");
	const result = await chatCompletion(model, 1500, CATEGORIZE_SYSTEM_PROMPT, numberedList, CATEGORIZE_SCHEMA);
	const categoryByIndex = parseCategoriesResponse(result);

	return items.map((item, index) => ({
		...item,
		category: categoryByIndex.get(index) ?? "other",
		estimatedPrice: null,
	}));
}

export async function estimatePrices(items: ListItem[], model: string): Promise<ListItem[]> {
	if (items.length === 0) return items;

	const numberedList = items.map((item, index) => `${index}. ${item.name} - ${item.quantity}`).join("\n");

	let result: unknown;
	try {
		result = await chatCompletion(`${model}:online`, 2000, PRICE_SYSTEM_PROMPT, numberedList, PRICE_SCHEMA);
	} catch (error) {
		// Pricing is a nice-to-have enrichment, not core to the list - a
		// network hiccup here shouldn't block showing the list itself.
		console.error("Price estimation request failed, leaving items unpriced", error);
		return items;
	}

	const priceByIndex = parsePricesResponse(result);

	return items.map((item, index) => ({
		...item,
		estimatedPrice: priceByIndex.get(index) ?? null,
	}));
}

function parseItemsResponse(result: unknown): Array<{ name?: unknown; quantity?: unknown; needsConfirmation?: unknown }> {
	const content = (result as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content;
	const parsed = typeof content === "string" ? safeJsonParse(content) : content;
	const items = (parsed as { items?: unknown })?.items;
	return Array.isArray(items) ? items : [];
}

function parseCategoriesResponse(result: unknown): Map<number, CategoryId> {
	const content = (result as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content;
	const parsed = typeof content === "string" ? safeJsonParse(content) : content;
	const categories = (parsed as { categories?: unknown })?.categories;
	const entries = Array.isArray(categories) ? categories : [];

	const map = new Map<number, CategoryId>();
	for (const entry of entries as Array<{ index?: unknown; category?: unknown }>) {
		const index = Number(entry?.index);
		if (Number.isInteger(index) && isCategoryId(entry?.category)) {
			map.set(index, entry.category);
		}
	}
	return map;
}

function parsePricesResponse(result: unknown): Map<number, number> {
	const content = (result as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content;
	const parsed = typeof content === "string" ? safeJsonParse(content) : content;
	const prices = (parsed as { prices?: unknown })?.prices;
	const entries = Array.isArray(prices) ? prices : [];

	const map = new Map<number, number>();
	for (const entry of entries as Array<{ index?: unknown; price_rupees?: unknown }>) {
		const index = Number(entry?.index);
		const price = Number(entry?.price_rupees);
		if (Number.isInteger(index) && Number.isFinite(price) && price > 0) {
			map.set(index, price);
		}
	}
	return map;
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
