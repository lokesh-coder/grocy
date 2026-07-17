import type { CategoryId } from "../shared/categories";
import type { DraftItem, ListItem } from "../shared/types";

// Stateless share links - the whole list is encoded into the URL itself,
// no server-side storage at all. grocy.store/l (see site/public/l) decodes
// the same way in plain JS and either hands off to the app or renders a
// read-only view directly in the browser if the app isn't installed.
const SHARE_BASE_URL = "https://grocy.store/l";

// A safety margin under practical URL length limits across apps/OSes (some
// Android intent handlers and older WhatsApp versions truncate well before
// the > 8000 char limits modern browsers support) - an unusually long list
// falls back to text-only sharing instead of handing out a broken link.
const MAX_URL_LENGTH = 1500;

// Tuple encoding, not objects - repeated key names ("name", "quantity", ...)
// would otherwise dominate the payload for a typical 8-15 item list.
type EncodedPayload =
	| { v: 1; o: false; items: Array<[string, string]> }
	| { v: 1; o: true; items: Array<[string, string, string, number | null]> };

function base64UrlEncode(str: string): string {
	const binary = unescape(encodeURIComponent(str));
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): string {
	const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
	const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
	const binary = atob(padded);
	return decodeURIComponent(escape(binary));
}

export function buildShareLink(items: DraftItem[], organizedItems: ListItem[] | null): string | null {
	if (items.length === 0) return null;

	const payload: EncodedPayload = organizedItems
		? { v: 1, o: true, items: organizedItems.map((item) => [item.name, item.quantity, item.category, item.estimatedPrice]) }
		: { v: 1, o: false, items: items.map((item) => [item.name, item.quantity]) };

	const encoded = base64UrlEncode(JSON.stringify(payload));
	const url = `${SHARE_BASE_URL}?d=${encoded}`;
	return url.length <= MAX_URL_LENGTH ? url : null;
}

export function parseShareLink(encoded: string): { items: DraftItem[]; organizedItems: ListItem[] | null } | null {
	try {
		const payload = JSON.parse(base64UrlDecode(encoded)) as EncodedPayload;
		if (payload.v !== 1 || !Array.isArray(payload.items)) return null;

		if (payload.o) {
			const organizedItems: ListItem[] = payload.items.map(([name, quantity, category, estimatedPrice], i) => ({
				id: `shared-${i}`,
				name,
				quantity,
				category: category as CategoryId,
				estimatedPrice,
			}));
			return { items: organizedItems.map(({ id, name, quantity }) => ({ id, name, quantity })), organizedItems };
		}

		const items: DraftItem[] = payload.items.map(([name, quantity], i) => ({ id: `shared-${i}`, name, quantity }));
		return { items, organizedItems: null };
	} catch {
		return null;
	}
}
