import type { CategoryId } from "../../shared/categories";

// One color per category from the "fun palette" defined in styles.css, so
// grouped sections read as visually distinct at a glance instead of uniform
// muted-gray labels - part of giving the app some personality since it has
// very few features to lean on otherwise.
const COLORS: Record<CategoryId, string> = {
	vegetables: "var(--color-fun-sage)",
	fruits: "var(--color-fun-gold)",
	grocery: "var(--color-fun-coral)",
	dairy: "var(--color-fun-blue)",
	medical: "var(--color-fun-berry)",
	household: "var(--color-fun-violet)",
	other: "var(--color-text-muted)",
};

export function categoryColor(id: CategoryId): string {
	return COLORS[id] ?? "var(--color-text-muted)";
}
