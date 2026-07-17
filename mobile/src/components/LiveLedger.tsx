import { ScrollView, StyleSheet, Text, View } from "react-native";
import { WarningCircleIcon } from "phosphor-react-native";
import { PopIn } from "./PopIn";
import { colors, fontFamily, radius } from "../theme/tokens";
import type { DraftItem } from "../shared/types";

type Props = {
	items: DraftItem[];
	pendingSegments: string[];
};

// Replaces the old raw-transcript teleprompter view - items now tick in
// live as they're parsed (see extract.ts's parseSegmentOps), so the real
// list exists *while* the person is talking, not only after "Done".
// Segments still waiting on their parse call show as a grey/italic ghost
// row at the bottom; a segment the live pass got wrong is still corrected
// by the authoritative full pass when "Done" runs, so this view stays
// simple (read-only, no delete) rather than trying to be the final product.
export function LiveLedger({ items, pendingSegments }: Props) {
	return (
		<ScrollView style={styles.box} contentContainerStyle={styles.content}>
			<View style={styles.card}>
				{items.map((item, i) => (
					<PopIn key={item.id} delay={i * 20}>
						<View style={[styles.row, (i < items.length - 1 || pendingSegments.length > 0) && styles.rowDivider]}>
							<View style={styles.nameRow}>
								{item.needsConfirmation && <WarningCircleIcon weight="fill" size={13} color={colors.fun.gold} />}
								<Text style={styles.name}>{item.name}</Text>
							</View>
							<Text style={styles.qty}>{item.quantity}</Text>
						</View>
					</PopIn>
				))}
				{pendingSegments.map((segment, i) => (
					<PopIn key={`pending-${i}`}>
						<View style={[styles.row, i < pendingSegments.length - 1 && styles.rowDivider]}>
							<Text style={styles.ghost} numberOfLines={1}>
								{segment}
							</Text>
						</View>
					</PopIn>
				))}
			</View>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	box: {
		flex: 1,
		width: "100%",
	},
	content: {
		flexGrow: 1,
		justifyContent: "flex-end",
		paddingVertical: 8,
	},
	card: {
		backgroundColor: colors.surface,
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radius.md,
		paddingHorizontal: 4,
	},
	row: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 12,
		paddingVertical: 10,
		gap: 8,
	},
	rowDivider: {
		borderBottomWidth: 1,
		borderStyle: "dashed",
		borderBottomColor: colors.borderStrong,
	},
	nameRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 5,
		flexShrink: 1,
	},
	name: {
		fontSize: 14,
		fontFamily: fontFamily.medium,
		color: colors.text,
		flexShrink: 1,
	},
	qty: {
		fontSize: 12,
		fontFamily: fontFamily.medium,
		color: colors.textMuted,
	},
	ghost: {
		fontSize: 13,
		fontFamily: fontFamily.medium,
		color: colors.textMuted,
		fontStyle: "italic",
		flex: 1,
	},
});
