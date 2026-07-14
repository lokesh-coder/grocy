import { useEffect } from "react";
import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from "react-native-reanimated";
import { spring } from "../theme/tokens";

type Props = {
	children: ReactNode;
	style?: StyleProp<ViewStyle>;
	delay?: number;
};

// Mount-in animation matching the web app's `pop-in`/`fade-slide-in`
// keyframes (scale+translateY+opacity, bounce easing) - used for list rows,
// category groups, and share-bar buttons appearing.
export function PopIn({ children, style, delay = 0 }: Props) {
	const progress = useSharedValue(0);

	useEffect(() => {
		progress.value = withDelay(delay, withSpring(1, spring));
	}, [delay, progress]);

	const animatedStyle = useAnimatedStyle(() => ({
		opacity: progress.value,
		transform: [
			{ scale: 0.9 + progress.value * 0.1 },
			{ translateY: (1 - progress.value) * 6 },
		],
	}));

	return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
