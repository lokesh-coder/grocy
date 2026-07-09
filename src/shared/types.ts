import type { CategoryId } from "./categories";

export type ListItem = {
	id: string;
	name: string;
	quantity: string;
	category: CategoryId;
};

export type SessionState = {
	transcript: string;
	items: ListItem[];
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
};
