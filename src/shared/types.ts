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
};

export type SharedListItem = ListItem & { ticked: boolean };

export type SharedList = {
	id: string;
	createdAt: number;
	items: SharedListItem[];
};
