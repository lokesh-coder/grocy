import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Item } from "../shared/types";

// Replaces the old server-backed "last list" (by slug) and "frequent items"
// (D1 aggregate query) now that there's no shared backend state - history
// lives on-device instead. Capped so storage doesn't grow unbounded; old
// lists just age out of the frequency ranking.
const HISTORY_KEY = "grocy-list-history";
const MAX_HISTORY = 30;

type StoredList = { items: Item[]; savedAt: number };

async function readHistory(): Promise<StoredList[]> {
	const raw = await AsyncStorage.getItem(HISTORY_KEY);
	if (!raw) return [];
	try {
		return JSON.parse(raw) as StoredList[];
	} catch {
		return [];
	}
}

export async function saveFinalizedList(items: Item[]): Promise<void> {
	const history = await readHistory();
	history.unshift({ items, savedAt: Date.now() });
	await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
}

export async function getLastList(): Promise<Item[] | null> {
	const history = await readHistory();
	return history[0]?.items ?? null;
}

// Overwrites the most recent entry in place (e.g. after deleting an item
// post-finalize) instead of pushing a new one - a delete isn't a new list,
// and unshifting here would double-count this list in the frequency
// ranking below.
export async function updateLastList(items: Item[]): Promise<void> {
	const history = await readHistory();
	if (history.length === 0) {
		history.unshift({ items, savedAt: Date.now() });
	} else {
		history[0] = { items, savedAt: history[0].savedAt };
	}
	await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

// Exact-name grouping (same as the old SQL query) - most recent quantity per
// name, ranked by how often it shows up across saved lists.
export async function getFrequentItems(limit = 8): Promise<{ name: string; quantity: string }[]> {
	const history = await readHistory();
	const byName = new Map<string, { quantity: string; freq: number; mostRecentAt: number }>();

	for (const list of history) {
		for (const item of list.items) {
			const existing = byName.get(item.name);
			if (!existing) {
				byName.set(item.name, { quantity: item.quantity, freq: 1, mostRecentAt: list.savedAt });
				continue;
			}
			existing.freq += 1;
			if (list.savedAt > existing.mostRecentAt) {
				existing.quantity = item.quantity;
				existing.mostRecentAt = list.savedAt;
			}
		}
	}

	return [...byName.entries()]
		.sort((a, b) => b[1].freq - a[1].freq)
		.slice(0, limit)
		.map(([name, v]) => ({ name, quantity: v.quantity }));
}
