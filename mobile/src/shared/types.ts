// Keep in sync with src/shared/types.ts
import type { CategoryId } from "./categories";

export type ListItem = {
	id: string;
	name: string;
	quantity: string;
	category: CategoryId;
	// Best-effort, filled in once via a web-search-grounded model call - null
	// when the model had no confident basis to estimate.
	estimatedPrice: number | null;
};

// Items aren't categorized or priced until "Organize" is triggered on demand
// (see /api/organize and extract.ts) - /api/extract returns them as-is, so
// Done stays fast and the reasoning pass on every live segment has less to
// decide.
export type DraftItem = Omit<ListItem, "category" | "estimatedPrice">;
