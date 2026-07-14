// Separate from the session id (which resets on every new list) - this
// persists across sessions specifically so a list can be recovered if the
// app gets closed right after Done, before tapping View or sharing it
// anywhere. Just the one most recent slug, not a history.
const LAST_LIST_KEY = "grocy-last-list-slug";

export function getLastListSlug(): string | null {
	return localStorage.getItem(LAST_LIST_KEY);
}

export function setLastListSlug(slug: string): void {
	localStorage.setItem(LAST_LIST_KEY, slug);
}
