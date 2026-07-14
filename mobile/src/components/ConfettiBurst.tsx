import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming, Easing } from "react-native-reanimated";
import { colors } from "../theme/tokens";

// Direct port of the web app's 6 hand-placed .confetti-piece rules (fixed
// tx/ty/rotation/color/delay per piece, not randomized) - a one-shot burst
// that plays once when the share screen mounts.
const PIECES = [
	{ color: colors.fun.coral, tx: -70, ty: -30, rot: -140, delay: 0 },
	{ color: colors.fun.gold, tx: -35, ty: -50, rot: 120, delay: 40 },
	{ color: colors.fun.sage, tx: 0, ty: -58, rot: -90, delay: 80 },
	{ color: colors.fun.blue, tx: 38, ty: -48, rot: 160, delay: 30 },
	{ color: colors.fun.berry, tx: 68, ty: -26, rot: -110, delay: 70 },
	{ color: colors.fun.violet, tx: 20, ty: -66, rot: 90, delay: 110 },
];

export function ConfettiBurst() {
	return (
		<View style={styles.container} pointerEvents="none">
			{PIECES.map((piece, i) => (
				<Piece key={i} {...piece} />
			))}
		</View>
	);
}

function Piece({ color, tx, ty, rot, delay }: { color: string; tx: number; ty: number; rot: number; delay: number }) {
	const progress = useSharedValue(0);

	useEffect(() => {
		progress.value = withDelay(delay, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
	}, [delay, progress]);

	const animatedStyle = useAnimatedStyle(() => ({
		opacity: progress.value < 0.78 ? 1 : (1 - progress.value) / 0.22,
		transform: [
			{ translateX: progress.value * tx },
			{ translateY: progress.value * ty },
			{ rotate: `${progress.value * rot}deg` },
			{ scale: 0.6 + progress.value * 0.4 },
		],
	}));

	return <Animated.View style={[styles.piece, { backgroundColor: color }, animatedStyle]} />;
}

const styles = StyleSheet.create({
	container: {
		position: "absolute",
		top: 0,
		left: "50%",
		width: 0,
		height: 0,
	},
	piece: {
		position: "absolute",
		top: 0,
		left: 0,
		width: 7,
		height: 7,
		borderRadius: 2,
	},
});
