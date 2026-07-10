import { Carrot, Orange, ShoppingCartSimple, Drop, FirstAidKit, House, Package, type Icon } from "@phosphor-icons/react";
import type { CategoryId } from "../../shared/categories";

const ICONS: Record<CategoryId, Icon> = {
	vegetables: Carrot,
	fruits: Orange,
	grocery: ShoppingCartSimple,
	dairy: Drop,
	medical: FirstAidKit,
	household: House,
	other: Package,
};

export function categoryIcon(id: CategoryId): Icon {
	return ICONS[id] ?? Package;
}
