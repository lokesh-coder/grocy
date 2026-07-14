import AsyncStorage from "@react-native-async-storage/async-storage";

// Separate from the session id (which resets on every new list) - this
// persists across sessions specifically so a list can be recovered if the
// app gets closed right after Done, before tapping View or sharing it
// anywhere. Just the one most recent slug, not a history.
const LAST_LIST_KEY = "grocy-last-list-slug";

export async function getLastListSlug(): Promise<string | null> {
	return AsyncStorage.getItem(LAST_LIST_KEY);
}

export async function setLastListSlug(slug: string): Promise<void> {
	await AsyncStorage.setItem(LAST_LIST_KEY, slug);
}
