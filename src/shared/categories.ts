// Fixed store taxonomy shared by the extraction prompt and the UI section order.
// Edit this list to add/remove/reorder categories — everything else derives from it.
export const CATEGORIES = [
	{ id: "vegetables", ta: "காய்கறிகள்", en: "Vegetables" },
	{ id: "fruits", ta: "பழங்கள்", en: "Fruits" },
	{ id: "grocery", ta: "மளிகை பொருட்கள்", en: "Grocery & Ingredients" },
	{ id: "dairy", ta: "பால் பொருட்கள் & முட்டை", en: "Dairy & Eggs" },
	{ id: "medical", ta: "மருந்தகம்", en: "Medical / Pharmacy" },
	{ id: "household", ta: "வீட்டு உபயோகப் பொருட்கள்", en: "Household" },
	{ id: "other", ta: "பிற", en: "Others" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as CategoryId[];

export function categoryLabel(id: string): { ta: string; en: string } {
	const found = CATEGORIES.find((c) => c.id === id);
	return found ?? CATEGORIES[CATEGORIES.length - 1];
}
