import type { ReactNode } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { spring } from "../theme/tokens";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = PressableProps & {
	children: ReactNode;
	style?: StyleProp<ViewStyle>;
	scaleTo?: number;
};

// Every tappable surface in the app (buttons, chips, icon buttons, list
// rows) uses this instead of a bare Pressable, so the "press down slightly,
// spring back" feel from the web app's `:active { transform: scale(...) }`
// rules is consistent everywhere rather than reimplemented per component.
export function PressableScale({ children, style, scaleTo = 0.94, onPressIn, onPressOut, ...rest }: Props) {
	const scale = useSharedValue(1);

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ scale: scale.value }],
	}));

	return (
		<AnimatedPressable
			style={[style, animatedStyle]}
			onPressIn={(e) => {
				scale.value = withSpring(scaleTo, spring);
				onPressIn?.(e);
			}}
			onPressOut={(e) => {
				scale.value = withSpring(1, spring);
				onPressOut?.(e);
			}}
			{...rest}
		>
			{children}
		</AnimatedPressable>
	);
}
