import { useEffect } from "react";
import { Pressable, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SolarIcon } from "react-native-solar-icons";
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withSequence,
	withSpring,
	withTiming,
} from "react-native-reanimated";
import { colors, shadow, spring } from "../theme/tokens";

type Props = {
	recording: boolean;
	onPress: () => void;
	size?: number;
};

// Rounded-square (not circular) mic button - part of a single consistent
// shape language across the whole app (see theme/tokens.ts's comment on
// this). A circle only reads as "the primary action" when nothing else
// nearby is also round; once a second button (Done) sits in the same row,
// two competing round shapes read as visually confusing rather than
// hierarchical - so hierarchy here comes from size/color instead of shape.
// Accent gradient with a continuous subtle "breathing" scale loop while
// idle (matches the web's `mic-breathe` keyframe), switches to a danger
// gradient with an expanding/fading pulse ring while recording (matches
// `mic-pulse`, which animates a growing box-shadow ring - RN can't animate
// shadow spread smoothly on Android, so this is a separate ring view
// instead, same visual read).
export function MicButton({ recording, onPress, size = 84 }: Props) {
	const cornerRadius = Math.round(size * 0.32);
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
					{ position: "absolute", width: size, height: size, borderRadius: cornerRadius, borderWidth: 2, borderColor: colors.danger },
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
					<LinearGradient
						colors={recording ? [colors.fun.gold, colors.dangerStrong] : [colors.fun.gold, colors.accentStrong]}
						start={{ x: 0.15, y: 0 }}
						end={{ x: 0.85, y: 1 }}
						style={{
							width: size,
							height: size,
							borderRadius: cornerRadius,
							alignItems: "center",
							justifyContent: "center",
							// Android needs an explicit backgroundColor on the same
							// view for elevation-based shadow to render reliably -
							// the gradient still paints on top of this.
							backgroundColor: recording ? colors.dangerStrong : colors.accentStrong,
							...shadow.md,
						}}
					>
						<SolarIcon name={recording ? "Stop" : "Microphone"} type="bold" size={Math.round(size * 0.38)} color={colors.onAccent} />
					</LinearGradient>
				</Pressable>
			</Animated.View>
		</View>
	);
}
