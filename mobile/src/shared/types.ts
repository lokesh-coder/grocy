// Keep in sync with src/shared/types.ts
import type { CategoryId } from "./categories";

// Structured alongside the human-readable "quantity" display string, not
// instead of it - value/unit let the app reason about amounts (addition,
// future filtering); display stays the source of truth for rendering and
// sharing since it already carries fraction/price formatting the raw
// numbers don't (see extract.ts).
export type Quantity = {
	value: number | null;
	unit: string | null;
	// The quantity phrase as actually heard, in original words - kept for
	// traceability when a parse looks wrong.
	spoken: string;
};

export type ConfirmationReason =
	| "vague_quantity"
	| "inferred_unit"
	| "default_quantity"
	| "uncertain_item_name"
	| "uncertain_brand"
	| "ambiguous_merge";

export type ListItem = {
	id: string;
	name: string;
	brand: string | null;
	variant: string | null;
	quantity: string;
	qty: Quantity;
	// Purpose/description the person attached to the item, e.g. "சாம்பார்க்கு"
	// (for sambar), "நல்லா பழுத்தது" (well ripened) - dropped before, now kept.
	note: string | null;
	// Price context separate from the display string (e.g. "₹20/பாக்கெட்")
	// so it's available structured, not just baked into "quantity" text.
	priceNote: string | null;
	category: CategoryId;
	// Best-effort, filled in once via a web-search-grounded model call - null
	// when the model had no confident basis to estimate.
	estimatedPrice: number | null;
	// True when the model guessed rather than parsed something explicit -
	// surfaced as a visual flag in the confirm screen so the user knows what
	// to double check, instead of silently trusting a guess (see extract.ts).
	needsConfirmation: boolean;
	confirmationReason: ConfirmationReason | null;
};

// Items aren't categorized or priced until "Organize" is triggered on demand
// (see /api/organize and extract.ts) - /api/extract returns them as-is, so
// Done stays fast and the reasoning pass on every live segment has less to
// decide.
export type DraftItem = Omit<ListItem, "category" | "estimatedPrice">;
