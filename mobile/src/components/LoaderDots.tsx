import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { colors } from "../theme/tokens";

// Three-dot "thinking" loader with staggered fun-palette colors, matching
// the web app's loader-dots (used for Done/Organize buttons while working).
// White dots inside a solid accent-colored button, since the fun-palette
// colors would blend into the gradient otherwise (same reasoning as the
// web's `.is-finalizing .loader-dot { background: white }` override).
type Props = {
	variant?: "fun" | "onAccent";
};

const DOT_COLORS = {
	fun: [colors.fun.coral, colors.fun.gold, colors.fun.blue],
	onAccent: [colors.onAccent, colors.onAccent, colors.onAccent],
};

export function LoaderDots({ variant = "fun" }: Props) {
	return (
		<View style={styles.row}>
			{DOT_COLORS[variant].map((color, i) => (
				<Dot key={i} color={color} delay={i * 150} />
			))}
		</View>
	);
}

function Dot({ color, delay }: { color: string; delay: number }) {
	const translateY = useSharedValue(0);

	useEffect(() => {
		translateY.value = withDelay(
			delay,
			withRepeat(withSequence(withTiming(-4, { duration: 400 }), withTiming(0, { duration: 400 })), -1, false),
		);
	}, [delay, translateY]);

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ translateY: translateY.value }],
	}));

	return <Animated.View style={[styles.dot, { backgroundColor: color }, animatedStyle]} />;
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
	},
	dot: {
		width: 6,
		height: 6,
		borderRadius: 3,
	},
});
