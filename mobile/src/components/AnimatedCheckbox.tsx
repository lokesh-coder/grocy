import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { PressableScale } from "./PressableScale";
import { colors, spring } from "../theme/tokens";

type Props = {
	checked: boolean;
	onToggle: () => void;
	color?: string;
};

// Border-only box that fills with `color` (defaults to accent, or the
// category's color on the shared list) and pops in a checkmark on check -
// matches the web app's `.check-box::after` bounce-in checkmark.
export function AnimatedCheckbox({ checked, onToggle, color = colors.accent }: Props) {
	const progress = useSharedValue(checked ? 1 : 0);

	useEffect(() => {
		progress.value = withSpring(checked ? 1 : 0, spring);
	}, [checked, progress]);

	const boxStyle = useAnimatedStyle(() => ({
		backgroundColor: interpolateColor(progress.value, [0, 1], [colors.surface, color]),
		borderColor: interpolateColor(progress.value, [0, 1], [colors.borderStrong, color]),
	}));

	const checkStyle = useAnimatedStyle(() => ({
		opacity: progress.value,
		transform: [{ scale: progress.value }, { rotate: "45deg" }, { translateY: -1 }],
	}));

	return (
		<PressableScale onPress={onToggle} style={styles.wrapper}>
			<Animated.View style={[styles.box, boxStyle]}>
				<Animated.View style={[styles.checkmark, checkStyle]} />
			</Animated.View>
		</PressableScale>
	);
}

const styles = StyleSheet.create({
	wrapper: {
		width: 22,
		height: 22,
	},
	box: {
		width: 22,
		height: 22,
		borderRadius: 6,
		borderWidth: 2,
		alignItems: "center",
		justifyContent: "center",
	},
	// A small rectangle with only its right+bottom borders visible, rotated
	// 45deg - the classic CSS-checkmark trick, same as the web app's
	// .check-box::after (no icon glyph needed for this one).
	checkmark: {
		width: 6,
		height: 11,
		borderRightWidth: 2.5,
		borderBottomWidth: 2.5,
		borderColor: colors.onAccent,
	},
});
