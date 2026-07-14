// Keep in sync with src/client/lib/categoryColors.ts / styles.css's "fun palette"
import type { CategoryId } from "../shared/categories";

const COLORS: Record<CategoryId, string> = {
	vegetables: "#6e9b72",
	fruits: "#e3a23d",
	grocery: "#d97757",
	dairy: "#5a8fb5",
	medical: "#b65c7a",
	household: "#8b7ec8",
	other: "#8f8574",
};

export function categoryColor(id: CategoryId): string {
	return COLORS[id] ?? "#8f8574";
}
