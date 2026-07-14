import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, fontFamily, radius } from "../theme/tokens";

type Props = {
	segments: string[];
};

// Plain list, not the web PWA's teleprompter styling - that's a cosmetic
// pass for later, not needed for parity (see the migration plan, Phase 1).
export function SegmentsList({ segments }: Props) {
	return (
		<ScrollView style={styles.box} contentContainerStyle={styles.content}>
			{segments.length === 0 && <Text style={styles.placeholder}>பேசும்போது உங்கள் வார்த்தைகள் இங்கே தோன்றும்.</Text>}
			{segments.map((segment, i) => (
				<View key={i} style={styles.segmentRow}>
					<Text style={styles.segment}>{segment}</Text>
				</View>
			))}
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	box: {
		flex: 1,
		width: "100%",
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radius.md,
		backgroundColor: colors.surface,
		padding: 16,
	},
	content: {
		gap: 10,
	},
	placeholder: {
		color: colors.textMuted,
		fontFamily: fontFamily.semibold,
		fontSize: 14,
		textAlign: "center",
		marginTop: 24,
	},
	segmentRow: {
		flexDirection: "row",
	},
	segment: {
		fontSize: 17,
		fontFamily: fontFamily.medium,
		color: colors.text,
	},
});
