import { CATEGORY_IDS, type CategoryId } from "../../shared/categories";
import type { ListItem } from "../../shared/types";

// Qwen3's reasoning mode is used deliberately in two separate calls rather
// than one call with both a rich prompt and a JSON schema constraint. Tested
// directly: even with reasoning turned on, combining it with a schema
// constraint in a single call let the model's final answer drift from its
// own (correct) reasoning conclusion - e.g. it reasoned that a cancelled
// item should be dropped, then still included it in the JSON anyway. Two
// calls avoids that: the first does the actual thinking in free text with no
// structural pressure, the second is a much simpler mechanical step that
// just formats an already-settled conclusion.
const REASONING_MODEL = "@cf/qwen/qwen3-30b-a3b-fp8" as const;

const REASONING_SYSTEM_PROMPT = `You are carefully listening to someone dictate a grocery list out loud in Tamil (sometimes mixed with English words, like brand names). People think out loud while doing this: they pause, restart, correct themselves, change their mind about an item entirely, or fix a quantity. Your job is to read the full transcript so far and reason through exactly what the person currently wants - not just what they said, but what they mean after accounting for every correction and replacement.

Think through it step by step:
1. Go through the transcript in order.
2. For each item mentioned, note its name (in Tamil, as spoken) and quantity.
3. If a later mention corrects an earlier one (same item, new quantity), keep only the latest quantity for that item.
4. If a later mention replaces an earlier item entirely (the person explicitly says they don't want it anymore, e.g. "இல்ல அது வேண்டாம்", "வேணாம்", "மாத்திடு"), remove the earlier item completely - do not keep both.
5. If a quantity phrase includes a price as well as a count (e.g. "பத்து பாக்கெட், ஒவ்வொன்றும் இருபது ரூபாய்" = ten packets, twenty rupees each), keep the count as the primary quantity and note the price alongside it (e.g. "10 பாக்கெட் (₹20/பாக்கெட்)") - don't confuse the price for a second, different quantity.
6. Ignore filler words, hesitations, and false starts ("ம்ம்", "பாரு", "இல்ல... இல்ல") - they're not items.

Each line of the final list must use exactly this format, with a pipe character separating the name from the quantity - nothing else on the line, no leading dash or bullet:
NAME|QUANTITY

Examples:

[Example 1 - simple quantity correction]
Transcript: "தக்காளி இரண்டு கிலோ. வெங்காயம் ஒரு கிலோ. தக்காளியை ஒரு கிலோவா மாத்து."
Reasoning: தக்காளி was first said as 2kg, then corrected to 1kg later ("தக்காளியை ஒரு கிலோவா மாத்து" = change tomato to 1kg). வெங்காயம் (onion) 1kg is unrelated and unchanged.
Final list:
தக்காளி|1 கிலோ
வெங்காயம்|1 கிலோ

[Example 2 - full replacement, not a correction]
Transcript: "தக்காளி இரண்டு கிலோ. இல்ல அது வேண்டாம், முள்ளங்கி வாங்கிக்கோ."
Reasoning: தக்காளி (2kg) was explicitly cancelled ("இல்ல அது வேண்டாம்" = no, don't need that) and replaced with முள்ளங்கி. No quantity was given for முள்ளங்கி, so use "1". தக்காளி must NOT appear in the final list - it was retracted, not corrected.
Final list:
முள்ளங்கி|1

[Example 3 - quantity vs. price in one phrase]
Transcript: "முடி எண்ணெய் பத்து பாக்கெட், ஒவ்வொன்றும் இருபது ரூபாய்."
Reasoning: "பத்து பாக்கெட்" (ten packets) is the count. "ஒவ்வொன்றும் இருபது ரூபாய்" (twenty rupees each) is a price, not a second quantity - note it alongside the count, don't let it replace it.
Final list:
முடி எண்ணெய்|10 பாக்கெட் (₹20/பாக்கெட்)

[Example 4 - thinking out loud]
Transcript: "எனக்கு... பாரு, முதலில் பால் வேணும்... ஒரு லிட்டர் பால். பிறகு... ம்ம்... முட்டை ஒரு டஜன்."
Reasoning: Filler words and hesitations ("பாரு", "ம்ம்") are ignored. Two clear items: பால் (milk) 1 லிட்டர், முட்டை (eggs) 1 டஜன்.
Final list:
பால்|1 லிட்டர்
முட்டை|1 டஜன்

Now read the actual transcript, reason through it the same way, and end your answer with a "Final list:" section using the NAME|QUANTITY format above, one item per line, in Tamil as spoken. Only include items the person currently wants - never something explicitly replaced or cancelled. If nothing has been said yet, the final list is empty.`;

const STRUCTURE_SYSTEM_PROMPT = (categories: string) =>
	`You're given an analysis of a Tamil grocery list, ending in a "Final list:" section formatted as NAME|QUANTITY, one item per line. Convert ONLY that final list into JSON matching the schema, splitting each line on its pipe character into separate name and quantity fields - do not re-analyze or second-guess the conclusion already reached, and do not add or drop items from it. Keep item names in Tamil exactly as given, and keep the quantity text exactly as given too (including any price note in parentheses). Assign each item to exactly one category id from this fixed list: ${categories}. Respond with JSON only.`;

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

export async function extractItems(ai: Ai, transcript: string): Promise<ListItem[]> {
	if (!transcript.trim()) return [];

	const reasoning = await runReasoningPass(ai, transcript);
	const rawItems = await runStructuringPass(ai, reasoning);

	return rawItems.map((item, index) => ({
		id: `item-${index}`,
		name: String(item.name ?? "").trim(),
		quantity: String(item.quantity ?? "1").trim() || "1",
		category: isCategoryId(item.category) ? item.category : "other",
	}));
}

// The generated per-model Ai.run() overloads (with a streaming variant per
// model) defeat TypeScript's Parameters<> extraction here, so the input is
// deliberately untyped rather than fighting overload resolution for a shape
// already verified directly against the live API. Recasting (not detaching)
// `ai` keeps `run()` a proper method call so `this` binding is preserved.
function runAi(ai: Ai, model: string, input: Record<string, unknown>): Promise<unknown> {
	const looselyTyped = ai as unknown as { run(model: string, input: Record<string, unknown>): Promise<unknown> };
	return looselyTyped.run(model, input);
}

async function runReasoningPass(ai: Ai, transcript: string): Promise<string> {
	const result = await runAi(ai, REASONING_MODEL, {
		messages: [
			{ role: "system", content: REASONING_SYSTEM_PROMPT },
			{ role: "user", content: transcript },
		],
	});

	return extractMessageText(result);
}

// response_format: json_schema is not a hard guarantee - verified directly
// that it occasionally still leaks malformed output (e.g. a name field like
// "பால் - 1 லிட்டர்'}, {" from a broken JSON string bleeding through). Retry
// once on an empty or obviously-malformed result before giving up; the
// caller's "don't overwrite a good list with a suspicious one" guard covers
// the case where both attempts fail.
async function runStructuringPass(
	ai: Ai,
	reasoning: string,
): Promise<Array<{ name?: unknown; quantity?: unknown; category?: unknown }>> {
	for (let attempt = 0; attempt < 2; attempt++) {
		const result = await runAi(ai, REASONING_MODEL, {
			messages: [
				{ role: "system", content: STRUCTURE_SYSTEM_PROMPT(CATEGORY_IDS.join(", ")) },
				{ role: "user", content: reasoning },
			],
			response_format: { type: "json_schema", json_schema: ITEMS_SCHEMA },
		});

		const rawItems = parseItemsResponse(result);
		if (rawItems.length > 0 && !looksMalformed(rawItems)) return rawItems;
	}
	return [];
}

function looksMalformed(items: Array<{ name?: unknown; quantity?: unknown }>): boolean {
	return items.some((item) => {
		const name = String(item.name ?? "");
		const quantity = String(item.quantity ?? "");
		// Braces/quotes/pipes leaking into a field mean JSON (or the
		// intermediate NAME|QUANTITY format) failed to split cleanly.
		const hasArtifact = (text: string) => /[{}|'"]/.test(text);
		return hasArtifact(name) || hasArtifact(quantity) || name.length > 60 || quantity.length > 60;
	});
}

// Qwen3 (OpenAI-compatible chat completion shape) puts the final answer in
// choices[0].message.content, separate from its reasoning trace. Fall back
// to `response` for models that use the simpler Workers AI shape.
function extractMessageText(result: unknown): string {
	const choiceContent = (result as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message
		?.content;
	if (typeof choiceContent === "string") return choiceContent;

	const response = (result as { response?: unknown })?.response;
	return typeof response === "string" ? response : "";
}

function parseItemsResponse(result: unknown): Array<{ name?: unknown; quantity?: unknown; category?: unknown }> {
	const choiceContent = (result as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message
		?.content;
	const responseField = choiceContent ?? (result as { response?: unknown })?.response ?? result;
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
