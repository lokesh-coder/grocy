import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MagicWandIcon, TrashIcon } from "phosphor-react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { CATEGORIES } from "../shared/categories";
import { categoryColor } from "../lib/categoryColors";
import { categoryIcon } from "../lib/categoryIcons";
import { deleteItem, getList, organizeList, setItemTicked } from "../lib/api";
import { AnimatedCheckbox } from "../components/AnimatedCheckbox";
import { AccentButton } from "../components/AccentButton";
import { LoaderDots } from "../components/LoaderDots";
import { PopIn } from "../components/PopIn";
import { colors, fontFamily, radius, spring } from "../theme/tokens";
import type { SharedList, SharedListItem } from "../shared/types";

const ORGANIZING_TEXT = "வகைப்படுத்தி விலை மதிப்பிடுகிறேன்…";

type Props = {
	slug: string;
};

export function SharedListScreen({ slug }: Props) {
	const insets = useSafeAreaInsets();
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
		<ScrollView
			style={styles.container}
			contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
		>
			{!list.organized && (
				<AccentButton onPress={handleOrganize} disabled={organizing}>
					{organizing ? (
						<>
							<LoaderDots variant="onAccent" />
							<Text style={styles.organizeButtonText}>{ORGANIZING_TEXT}</Text>
						</>
					) : (
						<>
							<MagicWandIcon weight="fill" size={17} color={colors.onAccent} />
							<Text style={styles.organizeButtonText}>வகைப்படுத்தி விலை காட்டு</Text>
						</>
					)}
				</AccentButton>
			)}

			{priceSummary && (
				<Text style={styles.priceSummary}>
					மதிப்பிடப்பட்ட மொத்தம்: ₹{Math.round(priceSummary.total)}
					{priceSummary.pricedCount < priceSummary.totalCount && ` (${priceSummary.pricedCount}/${priceSummary.totalCount} பொருட்களுக்கு)`}
				</Text>
			)}

			{!list.organized && (
				<View style={styles.group}>
					{list.items.map((item, i) => (
						<PopIn key={item.id} delay={i * 30}>
							<ItemRow item={item} onToggle={toggle} onDelete={handleDelete} />
						</PopIn>
					))}
				</View>
			)}

			{list.organized &&
				grouped.map((group, gi) => {
					const CategoryIcon = categoryIcon(group.category.id);
					return (
						<PopIn key={group.category.id} delay={gi * 60}>
							<View style={styles.group}>
								<View style={styles.groupHeader}>
									<CategoryIcon weight="regular" size={14} color={categoryColor(group.category.id)} />
									<Text style={[styles.groupTitle, { color: categoryColor(group.category.id) }]}>{group.category.ta}</Text>
								</View>
								{group.items.map((item, i) => (
									<PopIn key={item.id} delay={i * 30}>
										<ItemRow item={item} onToggle={toggle} onDelete={handleDelete} showPrice color={categoryColor(group.category.id)} />
									</PopIn>
								))}
							</View>
						</PopIn>
					);
				})}
		</ScrollView>
	);
}

function ItemRow({
	item,
	onToggle,
	onDelete,
	showPrice,
	color,
}: {
	item: SharedListItem;
	onToggle: (id: string, ticked: boolean) => void;
	onDelete: (id: string) => void;
	showPrice?: boolean;
	color?: string;
}) {
	return (
		<View style={styles.itemRow}>
			<AnimatedCheckbox checked={item.ticked} onToggle={() => onToggle(item.id, !item.ticked)} color={color} />
			<Pressable style={styles.itemTextCol} onPress={() => onToggle(item.id, !item.ticked)}>
				<Text style={[styles.itemName, item.ticked && styles.itemTicked]}>{item.name}</Text>
				<Text style={styles.itemQty}>
					{item.quantity}
					{showPrice && item.estimatedPrice != null && ` · ₹${Math.round(item.estimatedPrice)}`}
				</Text>
			</Pressable>
			<DeleteButton onPress={() => onDelete(item.id)} />
		</View>
	);
}

// Spring-rotates 90deg on press before the item removes, matching the web
// app's `.delete-item-button:active { transform: rotate(90deg) scale(0.8) }`.
function DeleteButton({ onPress }: { onPress: () => void }) {
	const rotation = useSharedValue(0);
	const scale = useSharedValue(1);

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ rotate: `${rotation.value}deg` }, { scale: scale.value }],
	}));

	return (
		<Pressable
			style={styles.deleteButton}
			onPressIn={() => {
				rotation.value = withSpring(90, spring);
				scale.value = withSpring(0.8, spring);
			}}
			onPressOut={() => {
				rotation.value = withSpring(0, spring);
				scale.value = withSpring(1, spring);
			}}
			onPress={onPress}
		>
			<Animated.View style={animatedStyle}>
				<TrashIcon weight="regular" size={18} color={colors.danger} />
			</Animated.View>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: colors.bg },
	content: { padding: 20, gap: 16 },
	centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
	hint: { color: colors.textMuted, fontFamily: fontFamily.medium },
	organizeButtonText: { color: colors.onAccent, fontFamily: fontFamily.bold, fontSize: 15 },
	priceSummary: {
		fontSize: 14,
		fontFamily: fontFamily.bold,
		color: colors.text,
		backgroundColor: colors.accentSoft,
		padding: 12,
		borderRadius: radius.sm,
	},
	group: { gap: 8 },
	groupHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
	groupTitle: { fontSize: 12, fontFamily: fontFamily.extrabold, letterSpacing: 0.5, textTransform: "uppercase" },
	itemRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		backgroundColor: colors.surface,
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radius.sm,
		paddingHorizontal: 12,
		paddingVertical: 10,
	},
	itemTextCol: { flex: 1 },
	itemName: { fontSize: 15, fontFamily: fontFamily.medium, color: colors.text },
	itemTicked: { textDecorationLine: "line-through", color: colors.textMuted },
	itemQty: { fontSize: 12, fontFamily: fontFamily.medium, color: colors.textMuted },
	deleteButton: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
});
