import { useEffect } from "react";
import { Pressable, View } from "react-native";
import { MicrophoneIcon, StopIcon } from "phosphor-react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withSequence,
	withSpring,
	withTiming,
} from "react-native-reanimated";
import { colors, spring } from "../theme/tokens";

type Props = {
	recording: boolean;
	onPress: () => void;
	size?: number;
};

// Circular, not rounded-square - a deliberate exception to the app's shape
// system (see theme/tokens.ts's comment on this), since a record button
// reading as a circle is a strong enough convention to break the rule for.
// Flat solid red fill in both states (colors.record, not accent/danger) - no
// gradient/shadow - a continuous subtle "breathing" scale loop while idle
// (matches the web's `mic-breathe` keyframe), adds an expanding/fading pulse
// ring on top while recording (matches `mic-pulse`).
export function MicButton({ recording, onPress, size = 84 }: Props) {
	const cornerRadius = size / 2;
	const breathe = useSharedValue(1);
	const press = useSharedValue(1);
	const ringScale = useSharedValue(1);
	const ringOpacity = useSharedValue(0);

	useEffect(() => {
		if (recording) {
			breathe.value = withTiming(1, { duration: 150 });
			ringScale.value = 1;
			ringOpacity.value = withRepeat(
				withSequence(withTiming(0.5, { duration: 0 }), withTiming(0, { duration: 1400, easing: Easing.out(Easing.cubic) })),
				-1,
				false,
			);
			ringScale.value = withRepeat(withSequence(withTiming(1, { duration: 0 }), withTiming(1.7, { duration: 1400, easing: Easing.out(Easing.cubic) })), -1, false);
		} else {
			ringOpacity.value = withTiming(0, { duration: 150 });
			breathe.value = withRepeat(withSequence(withTiming(1.045, { duration: 1300 }), withTiming(1, { duration: 1300 })), -1, true);
		}
	}, [recording, breathe, ringScale, ringOpacity]);

	const buttonStyle = useAnimatedStyle(() => ({
		transform: [{ scale: breathe.value * press.value }],
	}));

	const ringStyle = useAnimatedStyle(() => ({
		opacity: ringOpacity.value,
		transform: [{ scale: ringScale.value }],
	}));

	return (
		<View style={{ width: size + 32, height: size + 32, alignItems: "center", justifyContent: "center" }}>
			<Animated.View
				style={[
					{ position: "absolute", width: size, height: size, borderRadius: cornerRadius, borderWidth: 2, borderColor: colors.record },
					ringStyle,
				]}
			/>
			<Animated.View style={buttonStyle}>
				<Pressable
					onPressIn={() => {
						press.value = withSpring(0.92, spring);
					}}
					onPressOut={() => {
						press.value = withSpring(1, spring);
					}}
					onPress={onPress}
				>
					<View
						style={{
							width: size,
							height: size,
							borderRadius: cornerRadius,
							alignItems: "center",
							justifyContent: "center",
							backgroundColor: colors.record,
						}}
					>
						{recording ? (
							<StopIcon
								weight="duotone"
								size={Math.round(size * 0.38)}
								color={colors.onAccent}
								duotoneColor={colors.onAccent}
								duotoneOpacity={0.4}
							/>
						) : (
							<MicrophoneIcon
								weight="duotone"
								size={Math.round(size * 0.38)}
								color={colors.onAccent}
								duotoneColor={colors.onAccent}
								duotoneOpacity={0.4}
							/>
						)}
					</View>
				</Pressable>
			</Animated.View>
		</View>
	);
}
