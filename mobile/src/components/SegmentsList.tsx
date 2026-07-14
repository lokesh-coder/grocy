import { ScrollView, StyleSheet, Text } from "react-native";
import { PopIn } from "./PopIn";
import { colors, fontFamily } from "../theme/tokens";

type Props = {
	segments: string[];
};

// Teleprompter feel, matching the web app's notes-feed: newest line big/
// bold/vivid and centered ("direct to face" - this is the one thing you're
// watching while talking), older lines shrink and fade as they recede.
// Deliberately not styled like item cards - a rough or partial line
// shouldn't read as a broken list item, the real list only exists after
// Done. Colors cycle through the fun palette by each line's fixed position
// (not randomly), same as the web version. Assumes segments is non-empty -
// the empty state lives in RecordingScreen alongside quick-add chips.
const NOTES_COLORS = [colors.fun.coral, colors.fun.gold, colors.fun.sage, colors.fun.blue, colors.fun.berry, colors.fun.violet];

function noteLineStyle(originalIndex: number, distance: number) {
	return {
		color: NOTES_COLORS[originalIndex % NOTES_COLORS.length],
		fontSize: Math.max(11, 16 - distance * 1.6),
		opacity: Math.max(0.35, 1 - distance * 0.22),
		fontFamily: distance === 0 ? fontFamily.extrabold : distance === 1 ? fontFamily.bold : fontFamily.semibold,
	};
}

export function SegmentsList({ segments }: Props) {
	const reversed = [...segments].reverse();

	return (
		<ScrollView style={styles.box} contentContainerStyle={styles.content}>
			{reversed.map((segment, distance) => {
				const originalIndex = segments.length - 1 - distance;
				return (
					<PopIn key={originalIndex}>
						<Text style={[styles.line, noteLineStyle(originalIndex, distance)]}>{segment}</Text>
					</PopIn>
				);
			})}
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
		alignItems: "center",
		justifyContent: "center",
		gap: 6,
		paddingVertical: 8,
	},
	line: {
		textAlign: "center",
	},
});
