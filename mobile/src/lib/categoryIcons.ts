// Mirrors categoryColors.ts - a Solar icon name per category. Solar Icons is
// a generic UI icon set (not food-specific), so a couple of these are
// reasonable proxies (Sun for fruits, Bag for grocery) rather than literal
// matches - verified these names exist in the installed package's manifest.
import type { CategoryId } from "../shared/categories";

const ICONS: Record<CategoryId, string> = {
	vegetables: "Leaf",
	fruits: "Sun",
	grocery: "Bag",
	dairy: "Bottle",
	medical: "Pill",
	household: "Home",
	other: "MenuDots",
};

export function categoryIcon(id: CategoryId): string {
	return ICONS[id] ?? "MenuDots";
}
