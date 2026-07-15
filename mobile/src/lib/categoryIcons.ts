// Mirrors categoryColors.ts - a Phosphor icon component per category.
// Phosphor is a generic UI icon set (not food-specific), so a couple of
// these are reasonable proxies (Sun for fruits, Bag for grocery) rather
// than literal matches - verified these names exist in the installed
// package.
import { BagIcon, DotsThreeIcon, DropIcon, HouseIcon, LeafIcon, PillIcon, SunIcon, type Icon } from "phosphor-react-native";
import type { CategoryId } from "../shared/categories";

const ICONS: Record<CategoryId, Icon> = {
	vegetables: LeafIcon,
	fruits: SunIcon,
	grocery: BagIcon,
	dairy: DropIcon,
	medical: PillIcon,
	household: HouseIcon,
	other: DotsThreeIcon,
};

export function categoryIcon(id: CategoryId): Icon {
	return ICONS[id] ?? DotsThreeIcon;
}
