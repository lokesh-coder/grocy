import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SolarIcon } from "react-native-solar-icons";
import { PopIn } from "./PopIn";
import { colors, fontFamily, radius } from "../theme/tokens";

type Props = {
	segments: string[];
};

export function SegmentsList({ segments }: Props) {
	if (segments.length === 0) {
		return (
			<View style={styles.empty}>
				<SolarIcon name="Cart" type="linear" size={48} color={colors.accent} />
				<Text style={styles.placeholder}>பேசும்போது உங்கள் வார்த்தைகள் இங்கே தோன்றும்.</Text>
			</View>
		);
	}

	return (
		<ScrollView style={styles.box} contentContainerStyle={styles.content}>
			{segments.map((segment, i) => (
				<PopIn key={i}>
					<View style={styles.segmentCard}>
						<Text style={styles.segment}>{segment}</Text>
					</View>
				</PopIn>
			))}
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	box: {
		flex: 1,
		width: "100%",
	},
	content: {
		gap: 8,
		paddingVertical: 4,
	},
	empty: {
		flex: 1,
		width: "100%",
		alignItems: "center",
		justifyContent: "center",
		gap: 10,
		paddingHorizontal: 24,
	},
	placeholder: {
		color: colors.textMuted,
		fontFamily: fontFamily.semibold,
		fontSize: 14,
		textAlign: "center",
	},
	segmentCard: {
		backgroundColor: colors.surface,
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radius.sm,
		paddingVertical: 10,
		paddingHorizontal: 14,
	},
	segment: {
		fontSize: 16,
		fontFamily: fontFamily.medium,
		color: colors.text,
	},
});
