// Ported from the old Cloudflare Worker's src/server/lib/extract.ts - same
// prompts/schemas/reasoning effort, now calling OpenRouter directly with the
// user's own key (see openrouterAuth.ts) instead of routing through a
// backend that existed only to hide a shared key. Keep this in sync with
// that file if it still exists, or treat this as the sole copy once it's
// been removed.
import { CATEGORY_IDS, type CategoryId } from "../shared/categories";
import type { ConfirmationReason, DraftItem, ListItem } from "../shared/types";
import { ensureOpenRouterKey } from "./openrouterAuth";
import { getCustomInstructions } from "./customInstructions";
import { LIVE_MODEL_ID } from "./models";

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

const SYSTEM_PROMPT = `You read a running Tamil speech transcript of a grocery list someone is dictating out loud, sometimes mixed with English words (brand names, loanwords). People think out loud while doing this: they pause, restart, correct themselves, add more of something they already said, change their mind about an item entirely, or fix a quantity. Extract the current, de-duplicated set of grocery items the person currently wants - not just what they said, but what they mean after applying every correction, addition, and cancellation.

Think like an attentive person standing next to them, jotting the list down by ear - use real-world grocery knowledge to fill in what's implied, and honestly flag every place you had to guess.

Rules:
- CORRECTION: if a later mention restates the same item with a new quantity and no "add more" wording (e.g. a mid-sentence self-correction "அரை கிலோ... இல்ல முக்கால் கிலோ"), keep only the latest quantity for that item - one line item, not two.
- ADDITION: if a later mention adds MORE of an item already listed, signalled by words like "இன்னும்", "கூட", "இன்னொரு", "extra ஆ" (e.g. "தக்காளி ஒரு கிலோ... தக்காளி இன்னும் அரை கிலோ"), ADD to the earlier quantity instead of replacing it (1 kg + 1/2 kg = quantity "1 1/2 kg", qtyValue 1.5) - this is not a correction. If the two quantities can't be meaningfully combined (different units, e.g. kg vs packet), keep them as two separate line items and set confirmationReason "ambiguous_merge" on both.
- CANCELLATION: if a later mention replaces an earlier item entirely (the person explicitly says they don't want it anymore, e.g. "இல்ல அது வேண்டாம்", "வேணாம்", "மாத்திடு"), remove the earlier item completely - do not keep both.
- SWAP: "X க்கு பதிலா Y", "X மாத்தி Y போடு" means remove X, add Y - not both.
- VARIANTS STAY SEPARATE: the same base product mentioned with a different brand, variant, or pack size (e.g. "Aavin blue இரண்டு பாக்கெட்" and later "Aavin orange ஒரு பாக்கெட்") are different items - keep them as separate line items rather than merging just because the base name matches. Only merge two mentions into one line when they're clearly the same product; if unsure, keep them separate and set confirmationReason "ambiguous_merge".
- DISTRIBUTIVE: if one quantity is said to apply to several items together (e.g. "தக்காளி வெங்காயம் ஒவ்வொண்ணும் ஒரு கிலோ" = tomato and onion, one kg each), apply that quantity to each item individually, not split between them - unless the person clearly means a combined/mixed amount.
- A bare number with no unit takes its unit from how that item is actually sold: liquids (பால், எண்ணெய், தண்ணீர்) are normally mL or L, solids sold loose or by weight (காய்கறி, மசாலா, அரிசி) are normally g or kg, countable items (முட்டை, தேங்காய், எலுமிச்சை, சோப்பு) are "count". Judge which by realistic everyday package sizes for that specific item - e.g. "100" for oil is far more likely 100 mL than 100 kg. Every inferred unit gets needsConfirmation true, confirmationReason "inferred_unit".
- If a quantity is stated purely as an amount of money with no count or weight (e.g. "கறிவேப்பிலை பத்து ரூபாய்க்கு" = curry leaves for ten rupees), record it as that amount: quantity "₹10", qtyValue 10, qtyUnit "₹" - rather than inventing a weight or count that was never said.
- If a quantity phrase includes a price as well as a count (e.g. "பத்து பாக்கெட், ஒவ்வொன்றும் இருபது ரூபாய்" = ten packets, twenty rupees each, or "நான்கு பாக்கெட் ஒரு ரூபாய்" = four one-rupee packets), keep the count as the primary quantity (qtyValue 10, qtyUnit "packet") and put the price in priceNote (e.g. "₹20/பாக்கெட்") as well as in the quantity display (e.g. "10 பாக்கெட் (₹20/பாக்கெட்)") - don't confuse the price for a second, different quantity.
- If one price is said to cover several different items together (e.g. "இவ இரண்டுக்கும் சேர்ந்து முப்பது ரூபாய்" = thirty rupees combined for both of these), don't drop that price - put it in priceNote on each of those items (e.g. "மொத்தம் ₹30 இரண்டுக்கும்") and reflect it in the quantity display too.
- Always write counts using Arabic numerals, never spelled-out number words - "இரண்டு", "ரெண்டு", and "மூணு" all become "2" and "3", not the Tamil words themselves.
- Write units as standard English abbreviations, not Tamil words, in both the quantity display and qtyUnit: கிலோ becomes "kg", லிட்டர் becomes "Lit", கிராம் becomes "g", மில்லி becomes "ml". Spoken fractions become numeric fractions in the display string the same way - அரை (half) becomes "1/2", கால் (quarter) becomes "1/4", முக்கால் (three-quarter) becomes "3/4" - e.g. "அரை கிலோ" becomes "1/2 kg" (qtyValue 0.5, never the fraction string).
- Flowers and garlands are sometimes measured in முழம் (a traditional arm-length unit) - there's no standard English equivalent for it, so keep it as "mulam" in both the quantity display and qtyUnit (e.g. "2 mulam").
- Vague quantities ("கொஞ்சம்", "கொஞ்சம் அதிகமா", "இன்னும் கொஞ்சம்") are a real answer, not a missing one - keep the quantity display as spoken (e.g. "கொஞ்சம்"), leave qtyValue and qtyUnit null, and set needsConfirmation true, confirmationReason "vague_quantity". Never invent a number or unit for them.
- If no quantity was mentioned at all for an item, use exactly "1" as the quantity display and qtyValue 1 (qtyUnit inferred as above) - never leave it blank - but always set needsConfirmation true, confirmationReason "default_quantity". A silent default is a silent guess.
- If the person attaches a purpose or description to an item (e.g. "தக்காளி நல்லா பழுத்தது வேணும்" = want well-ripened tomatoes, "சாம்பார்க்கு வெங்காயம்" = onion for sambar), keep that in note - don't drop it and don't fold it into the item name or quantity.
- Ignore filler words, hesitations, and false starts ("ம்ம்", "பாரு", "இல்ல... இல்ல") - they're not items.
- Ignore speech clearly not directed at the list - talking to someone else, background TV, a phone call ("சாப்பிட்டியா?", "டிவி சத்தம் குறை") - none of that is an item either. If the whole transcript is chatter like this with nothing list-worthy, return an empty list.
- Speech recognition occasionally repeats a phrase or glitches during silence - if the exact same item+quantity phrase appears twice in a row with nothing else between them, treat it as one mention, not as an addition.
- Keep item names in Tamil exactly as spoken - except when a name is really a Tamil-script phonetic spelling of an English word or brand name (e.g. "எஸ் வி எஸ்" = "SVS", "ஹார்லிக்ஸ்" = "Horlicks", "டைப்பர்" = "Diaper"). Speech recognition transliterates English words into Tamil script since it's listening in Tamil, but these are conventionally written in English - write them that way instead of the Tamil transliteration.
- "பொன்னி", "பச்சரிசி", "புழுங்கல் அரிசி", "இட்லி அரிசி" are rice VARIETIES, not brands - keep them in the item name or variant, never replace with a brand from the list below.
- When a brand is clearly stated or a confident phonetic match to a known brand (see the list below), put it in brand and also keep it as part of the natural item name (e.g. name "Aavin blue பால்", brand "Aavin", variant "blue"). If a name resembles a brand but you're not confident, or it may be a different/local brand, keep it exactly as heard in the name, leave brand null, and set needsConfirmation true, confirmationReason "uncertain_brand". Never force-fit an unknown name onto the list below.
- Only include items the person currently wants - never something explicitly replaced or cancelled. If nothing has been said yet, return an empty list.
- Set needsConfirmation true and confirmationReason to the matching reason whenever you guessed rather than parsed something plainly stated: vague_quantity, inferred_unit, default_quantity, uncertain_item_name (garbled audio), uncertain_brand, or ambiguous_merge. Set needsConfirmation false and confirmationReason null when the item and quantity were stated clearly. A wrong flagged guess is fine, a wrong silent one isn't.

Common Tamil Nadu grocery brand names, in case speech recognition garbles them - use these spellings whenever the transcript is a plausible phonetic match, even if the letters look quite different:
Dairy: Aavin, Arokya, Hatsun, Milky Mist. Oils: Gold Winner, Idhayam, Fortune, Sunpure, VVD. Ghee: RKG, GRB, Aavin. Masala: Sakthi, Aachi, MTR, Everest. Tea/Coffee: 3 Roses, AVT, Chakra Gold, Bru, Nescafe, Narasus. Rice/Atta: India Gate, Aashirvaad. Dal: Udhaiyam. Semiya/Rava: Anil, Bambino. Biscuits/Snacks: Parle-G, Milk Bikis, Marie Gold, Hide & Seek. Cleaning: Surf Excel, Rin, Ponvandu, Vim, Harpic, Lizol. Personal care: Hamam, Mysore Sandal, Ponds, Cinthol, Meera, Chik.

Examples (schema abbreviated to the fields that matter per example):

1) Addition, not correction: transcript "தக்காளி ஒரு கிலோ... தக்காளி இன்னும் அரை கிலோ" → one item, name "தக்காளி", quantity "1 1/2 kg", qtyValue 1.5, qtyUnit "kg", needsConfirmation false.
2) Bare number + default quantity: transcript "எண்ணெய் நூறு, அப்புறம் தேங்காய்" → [{name:"எண்ணெய்", quantity:"100 ml", qtyValue:100, qtyUnit:"ml", needsConfirmation:true, confirmationReason:"inferred_unit"}, {name:"தேங்காய்", quantity:"1", qtyValue:1, qtyUnit:"count", needsConfirmation:true, confirmationReason:"default_quantity"}].
3) Vague quantity + variants stay separate: transcript "Aavin blue ரெண்டு பாக்கெட். Aavin orange ஒரு பாக்கெட். ஏலக்காய் கொஞ்சம்." → three items: "Aavin blue பால்" (brand "Aavin", variant "blue", quantity "2 packet"), "Aavin orange பால்" (brand "Aavin", variant "orange", quantity "1 packet"), "ஏலக்காய்" (quantity "கொஞ்சம்", qtyValue null, qtyUnit null, needsConfirmation true, confirmationReason "vague_quantity").
4) Pure chatter: transcript "டிவி சத்தம் குறை... சாப்பிட்டியா நீ?" → empty items list.`;

// Shared by the full extraction schema and the live ops schema below - one
// item's shape shouldn't drift between the two call sites.
const ITEM_SCHEMA_PROPERTIES = {
	name: { type: "string" },
	brand: { type: ["string", "null"] },
	variant: { type: ["string", "null"] },
	quantity: { type: "string" },
	qtyValue: { type: ["number", "null"] },
	qtyUnit: { type: ["string", "null"] },
	qtySpoken: { type: "string" },
	note: { type: ["string", "null"] },
	priceNote: { type: ["string", "null"] },
	needsConfirmation: { type: "boolean" },
	confirmationReason: {
		type: ["string", "null"],
		enum: ["vague_quantity", "inferred_unit", "default_quantity", "uncertain_item_name", "uncertain_brand", "ambiguous_merge", null],
	},
} as const;

const ITEM_SCHEMA_REQUIRED = [
	"name",
	"brand",
	"variant",
	"quantity",
	"qtyValue",
	"qtyUnit",
	"qtySpoken",
	"note",
	"priceNote",
	"needsConfirmation",
	"confirmationReason",
];

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
					properties: ITEM_SCHEMA_PROPERTIES,
					required: ITEM_SCHEMA_REQUIRED,
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
			temperature: 0,
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

	const result = await chatCompletion(model, 4500, systemPrompt, transcript, ITEMS_SCHEMA);
	const rawItems = parseItemsResponse(result);

	return rawItems.map((item, index) => ({
		id: `item-${index}`,
		...toDraftItemFields(item),
	}));
}

function nullableString(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed ? trimmed : null;
}

function toDraftItemFields(item: RawItem): Omit<DraftItem, "id"> {
	return {
		name: String(item.name ?? "").trim(),
		brand: nullableString(item.brand),
		variant: nullableString(item.variant),
		quantity: String(item.quantity ?? "1").trim() || "1",
		qty: {
			value: typeof item.qtyValue === "number" ? item.qtyValue : null,
			unit: nullableString(item.qtyUnit),
			spoken: String(item.qtySpoken ?? "").trim(),
		},
		note: nullableString(item.note),
		priceNote: nullableString(item.priceNote),
		needsConfirmation: Boolean(item.needsConfirmation),
		confirmationReason: isConfirmationReason(item.confirmationReason) ? item.confirmationReason : null,
	};
}

// --- Live, per-segment extraction (see RecordingScreen.tsx) ---
//
// While the person is still dictating, each finalized speech segment is
// parsed individually against the list-so-far and turned into operations
// (add/update/remove) instead of re-parsing the whole transcript - this is
// what lets items tick into view as they're spoken instead of only
// appearing after "Done". Deliberately smaller/cheaper than SYSTEM_PROMPT
// above (no pricing edge cases, two examples instead of four) since it runs
// once per segment on a fast/cheap model - the full prompt still runs once,
// on the stronger model, when the mic stops (extractItems), so anything
// this pass gets wrong is still caught by an authoritative final pass.
const OPS_SYSTEM_PROMPT = `You maintain a live Tamil grocery list ledger while someone dictates it out loud, one short speech segment at a time. You'll get the current committed list (each line "[id] name — quantity") and the newest segment they just said. Decide what operations to apply - don't reprocess the whole list, just react to this one new segment.

Rules:
- ADD a new item for something not already on the list.
- UPDATE an existing item (same id) when this segment corrects its quantity ("இல்ல முக்கால் கிலோ" right after a wrong amount - replace, don't add) or adds more to it ("இன்னும் அரை கிலோ" - add to the existing quantity, e.g. 1 kg + 1/2 kg = "1 1/2 kg"). For an update, give the item's complete new state, not just the changed field.
- REMOVE an existing item (same id) when the person explicitly cancels it ("வேணாம்", "அது வேண்டாம்", "எடுத்துடு").
- A segment can produce multiple operations (e.g. two items mentioned in one breath) or zero (filler, chatter, or speech not about the list - "ம்ம்", talking to someone else, TV). Never guess an operation just to produce output.
- The same base product with a different brand/variant/pack size than what's already on the list is a separate ADD, not an update of the existing line (e.g. "Aavin orange" after an existing "Aavin blue" line).
- A bare number with no unit takes its unit from how that item is realistically sold (liquids in ml/L, loose solids in g/kg, countable items as "count") - flag needsConfirmation true, confirmationReason "inferred_unit". If genuinely no quantity was said for a new item, use quantity "1" and flag confirmationReason "default_quantity".
- Vague quantities ("கொஞ்சம்") are a real answer - keep the quantity display as spoken, qtyValue/qtyUnit null, flag confirmationReason "vague_quantity".
- Keep item names in Tamil as spoken, except phonetic English/brand transliterations ("ஹார்லிக்ஸ்" → "Horlicks") which get written in English.
- Common brands, use these spellings on a confident phonetic match: Aavin, Arokya, Hatsun, Milky Mist, Gold Winner, Idhayam, Fortune, Sakthi, Aachi, MTR, 3 Roses, AVT, Bru, Aashirvaad. If unsure, keep the name as heard and flag confirmationReason "uncertain_brand".
- If the person attaches a purpose/description ("சாம்பார்க்கு", "நல்லா பழுத்தது"), keep it in note.

This is a live, incremental pass - it doesn't need to be perfect, a slower full re-check runs once dictation finishes.

Example: committed list has "[live-0] தக்காளி — 1 kg". Segment "இன்னும் அரை கிலோ" → one UPDATE on live-0, quantity "1 1/2 kg", qtyValue 1.5.
Example: committed list is empty. Segment "எண்ணெய் நூறு" → one ADD, name "எண்ணெய்", quantity "100 ml", qtyValue 100, qtyUnit "ml", needsConfirmation true, confirmationReason "inferred_unit".`;

const OPS_SCHEMA = {
	name: "list_operations",
	strict: true,
	schema: {
		type: "object",
		properties: {
			operations: {
				type: "array",
				items: {
					type: "object",
					properties: {
						op: { type: "string", enum: ["add", "update", "remove"] },
						id: { type: ["string", "null"] },
						item: {
							type: ["object", "null"],
							properties: ITEM_SCHEMA_PROPERTIES,
							required: ITEM_SCHEMA_REQUIRED,
							additionalProperties: false,
						},
					},
					required: ["op", "id", "item"],
					additionalProperties: false,
				},
			},
		},
		required: ["operations"],
		additionalProperties: false,
	},
};

export type ListOperation = {
	op: "add" | "update" | "remove";
	id: string | null;
	item: Omit<DraftItem, "id"> | null;
};

function serializeCommittedList(items: DraftItem[]): string {
	if (items.length === 0) return "(இதுவரை பொருட்கள் இல்லை)";
	return items.map((item) => `[${item.id}] ${item.name} — ${item.quantity}`).join("\n");
}

export async function parseSegmentOps(committed: DraftItem[], segment: string): Promise<ListOperation[]> {
	if (!segment.trim()) return [];

	const custom = await getCustomInstructions();
	const systemPrompt = custom
		? `${OPS_SYSTEM_PROMPT}\n\nThe user has also given these additional standing instructions - follow them too:\n${custom}`
		: OPS_SYSTEM_PROMPT;
	const userContent = `Committed list:\n${serializeCommittedList(committed)}\n\nNew segment: "${segment}"`;

	const result = await chatCompletion(LIVE_MODEL_ID, 700, systemPrompt, userContent, OPS_SCHEMA);
	return parseOpsResponse(result);
}

// Pure reducer, no network - applying the operations is separate from
// fetching them so RecordingScreen can call this synchronously once ops
// come back, against whatever the live list has become since the call
// started (see liveItemsRef there).
export function applyOperations(items: DraftItem[], ops: ListOperation[], nextId: () => string): DraftItem[] {
	let next = items;
	for (const op of ops) {
		if (op.op === "add" && op.item) {
			next = [...next, { id: nextId(), ...op.item }];
		} else if (op.op === "update" && op.id && op.item) {
			const item = op.item;
			next = next.map((existing) => (existing.id === op.id ? { id: existing.id, ...item } : existing));
		} else if (op.op === "remove" && op.id) {
			next = next.filter((existing) => existing.id !== op.id);
		}
	}
	return next;
}

function parseOpsResponse(result: unknown): ListOperation[] {
	const content = (result as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content;
	const parsed = typeof content === "string" ? safeJsonParse(content) : content;
	const operations = (parsed as { operations?: unknown })?.operations;
	const entries = Array.isArray(operations) ? (operations as Array<{ op?: unknown; id?: unknown; item?: unknown }>) : [];

	const ops: ListOperation[] = [];
	for (const entry of entries) {
		if (entry.op !== "add" && entry.op !== "update" && entry.op !== "remove") continue;
		const id = typeof entry.id === "string" ? entry.id : null;
		const item = entry.item && typeof entry.item === "object" ? toDraftItemFields(entry.item as RawItem) : null;
		if (entry.op !== "remove" && !item) continue;
		if (entry.op !== "add" && !id) continue;
		ops.push({ op: entry.op, id, item });
	}
	return ops;
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

type RawItem = {
	name?: unknown;
	brand?: unknown;
	variant?: unknown;
	quantity?: unknown;
	qtyValue?: unknown;
	qtyUnit?: unknown;
	qtySpoken?: unknown;
	note?: unknown;
	priceNote?: unknown;
	needsConfirmation?: unknown;
	confirmationReason?: unknown;
};

function parseItemsResponse(result: unknown): RawItem[] {
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

const CONFIRMATION_REASONS: ConfirmationReason[] = [
	"vague_quantity",
	"inferred_unit",
	"default_quantity",
	"uncertain_item_name",
	"uncertain_brand",
	"ambiguous_merge",
];

function isConfirmationReason(value: unknown): value is ConfirmationReason {
	return typeof value === "string" && (CONFIRMATION_REASONS as string[]).includes(value);
}
