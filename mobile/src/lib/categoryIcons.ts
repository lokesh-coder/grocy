// Mirrors categoryColors.ts - a Lucide icon component per category. Lucide
// is a generic UI icon set (not food-specific), so a couple of these are
// reasonable proxies (Sun for fruits, ShoppingBag for grocery) rather than
// literal matches - verified these names exist in the installed package.
import { Droplet, Ellipsis, House, Leaf, Pill, ShoppingBag, Sun, type LucideIcon } from "lucide-react-native";
import type { CategoryId } from "../shared/categories";

const ICONS: Record<CategoryId, LucideIcon> = {
	vegetables: Leaf,
	fruits: Sun,
	grocery: ShoppingBag,
	dairy: Droplet,
	medical: Pill,
	household: House,
	other: Ellipsis,
};

export function categoryIcon(id: CategoryId): LucideIcon {
	return ICONS[id] ?? Ellipsis;
}
