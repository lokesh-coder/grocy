import type { CategoryId } from "./categories";

export type ListItem = {
	id: string;
	name: string;
	quantity: string;
	category: CategoryId;
	// Best-effort, filled in once at finalize via a web-search-grounded model
	// call - null when the model had no confident basis to estimate.
	estimatedPrice: number | null;
};

// Items aren't categorized or priced until the shared list page's "Organize"
// step is triggered on demand (see the /organize route and extract.ts) -
// finalize() just saves them as-is, so Done stays fast and the reasoning
// pass on every live segment has less to decide.
export type DraftItem = Omit<ListItem, "category" | "estimatedPrice">;

export type SessionState = {
	transcript: string;
	// Only populated once, by the single extraction pass in finalize() - stays
	// empty for the whole live-dictation phase (see the client's local raw
	// segment feed for what's shown while recording instead).
	items: DraftItem[];
	status: "idle" | "recording" | "extracting" | "done";
	finalizedSlug: string | null;
};

export type SharedListItem = ListItem & { ticked: boolean };

export type SharedList = {
	id: string;
	createdAt: number;
	items: SharedListItem[];
	// False until the "Organize" step (categorize + estimate prices) has run
	// - see the /api/list/:slug/organize route.
	organized: boolean;
};
