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
	items: DraftItem[];
	status: "idle" | "recording" | "extracting" | "done";
	finalizedSlug: string | null;
	// Items the speaker mis-transcribed and deleted from the live list.
	// Extraction re-derives the full item list from the transcript on every
	// update, so a plain client-side removal wouldn't stick - this exclusion
	// list is what makes a delete permanent for the rest of the session.
	deletedItemKeys: string[];
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
