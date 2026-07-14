import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { CATEGORIES } from "../shared/categories";
import { categoryColor } from "../lib/categoryColors";
import { deleteItem, getList, organizeList, setItemTicked } from "../lib/api";
import type { SharedList, SharedListItem } from "../shared/types";

const ORGANIZING_TEXT = "வகைப்படுத்தி விலை மதிப்பிடுகிறேன்…";

type Props = {
	slug: string;
};

export function SharedListScreen({ slug }: Props) {
	const [list, setList] = useState<SharedList | null>(null);
	const [notFound, setNotFound] = useState(false);
	const [organizing, setOrganizing] = useState(false);

	useEffect(() => {
		let cancelled = false;
		getList(slug)
			.then((data) => {
				if (!cancelled) setList(data);
			})
			.catch(() => {
				if (!cancelled) setNotFound(true);
			});
		return () => {
			cancelled = true;
		};
	}, [slug]);

	const grouped = useMemo(() => {
		if (!list) return [];
		return CATEGORIES.map((category) => ({
			category,
			items: list.items.filter((item) => item.category === category.id),
		})).filter((group) => group.items.length > 0);
	}, [list]);

	const priceSummary = useMemo(() => {
		if (!list) return null;
		const priced = list.items.filter((item) => item.estimatedPrice != null);
		if (priced.length === 0) return null;
		const total = priced.reduce((sum, item) => sum + (item.estimatedPrice ?? 0), 0);
		return { total, pricedCount: priced.length, totalCount: list.items.length };
	}, [list]);

	async function handleOrganize() {
		setOrganizing(true);
		try {
			setList(await organizeList(slug));
		} finally {
			setOrganizing(false);
		}
	}

	async function toggle(itemId: string, ticked: boolean) {
		setList((prev) => (prev ? { ...prev, items: prev.items.map((item) => (item.id === itemId ? { ...item, ticked } : item)) } : prev));
		await setItemTicked(slug, itemId, ticked);
	}

	async function handleDelete(itemId: string) {
		setList((prev) => (prev ? { ...prev, items: prev.items.filter((item) => item.id !== itemId) } : prev));
		await deleteItem(slug, itemId);
	}

	if (notFound) {
		return (
			<View style={styles.centered}>
				<Text style={styles.hint}>இந்தப் பட்டியல் கிடைக்கவில்லை.</Text>
			</View>
		);
	}

	if (!list) {
		return (
			<View style={styles.centered}>
				<Text style={styles.hint}>ஏற்றுகிறது…</Text>
			</View>
		);
	}

	return (
		<ScrollView style={styles.container} contentContainerStyle={styles.content}>
			{!list.organized && (
				<Pressable style={[styles.organizeButton, organizing && styles.disabled]} disabled={organizing} onPress={handleOrganize}>
					<Text style={styles.organizeButtonText}>{organizing ? ORGANIZING_TEXT : "வகைப்படுத்தி விலை காட்டு"}</Text>
				</Pressable>
			)}

			{priceSummary && (
				<Text style={styles.priceSummary}>
					மதிப்பிடப்பட்ட மொத்தம்: ₹{Math.round(priceSummary.total)}
					{priceSummary.pricedCount < priceSummary.totalCount && ` (${priceSummary.pricedCount}/${priceSummary.totalCount} பொருட்களுக்கு)`}
				</Text>
			)}

			{!list.organized && (
				<View style={styles.group}>
					{list.items.map((item) => (
						<ItemRow key={item.id} item={item} onToggle={toggle} onDelete={handleDelete} />
					))}
				</View>
			)}

			{list.organized &&
				grouped.map((group) => (
					<View key={group.category.id} style={styles.group}>
						<Text style={[styles.groupTitle, { color: categoryColor(group.category.id) }]}>{group.category.ta}</Text>
						{group.items.map((item) => (
							<ItemRow key={item.id} item={item} onToggle={toggle} onDelete={handleDelete} showPrice />
						))}
					</View>
				))}
		</ScrollView>
	);
}

function ItemRow({
	item,
	onToggle,
	onDelete,
	showPrice,
}: {
	item: SharedListItem;
	onToggle: (id: string, ticked: boolean) => void;
	onDelete: (id: string) => void;
	showPrice?: boolean;
}) {
	return (
		<View style={styles.itemRow}>
			<Pressable style={styles.checkboxRow} onPress={() => onToggle(item.id, !item.ticked)}>
				<View style={[styles.checkbox, item.ticked && styles.checkboxChecked]} />
				<View style={styles.itemTextCol}>
					<Text style={[styles.itemName, item.ticked && styles.itemTicked]}>{item.name}</Text>
					<Text style={styles.itemQty}>
						{item.quantity}
						{showPrice && item.estimatedPrice != null && ` · ₹${Math.round(item.estimatedPrice)}`}
					</Text>
				</View>
			</Pressable>
			<Pressable style={styles.deleteButton} onPress={() => onDelete(item.id)}>
				<Text style={styles.deleteButtonText}>×</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#fff" },
	content: { padding: 20, paddingTop: 60, gap: 16 },
	centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
	hint: { color: "#8f8574" },
	organizeButton: { backgroundColor: "#111", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
	disabled: { opacity: 0.6 },
	organizeButtonText: { color: "#fff", fontWeight: "700" },
	priceSummary: { fontSize: 14, color: "#444" },
	group: { gap: 8 },
	groupTitle: { fontSize: 14, fontWeight: "700", marginBottom: 2 },
	itemRow: { flexDirection: "row", alignItems: "center", gap: 8 },
	checkboxRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
	checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: "#ccc" },
	checkboxChecked: { backgroundColor: "#6e9b72", borderColor: "#6e9b72" },
	itemTextCol: { flex: 1 },
	itemName: { fontSize: 16, color: "#111" },
	itemTicked: { textDecorationLine: "line-through", color: "#999" },
	itemQty: { fontSize: 13, color: "#888" },
	deleteButton: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
	deleteButtonText: { fontSize: 18, color: "#c0392b" },
});
