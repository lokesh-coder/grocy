import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { Mic, Square } from "lucide-react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withSequence,
	withSpring,
	withTiming,
} from "react-native-reanimated";
import { colors, fontFamily, spring } from "../theme/tokens";

type Props = {
	recording: boolean;
	onPress: () => void;
	// "circle" (default): size is the diameter. "chip": size is the height,
	// chipWidth is the width - a pill rather than a circle. Experimenting
	// with the chip shape for the floating RecordCard - defaulting to
	// "circle" means every other call site is unaffected.
	size?: number;
	shape?: "circle" | "chip";
	chipWidth?: number;
	// Only rendered in "chip" mode - a circle has no room for a label.
	label?: string;
};

// Circular (or, in "chip" mode, a pill) - not rounded-square, a deliberate
// exception to the app's shape system (see theme/tokens.ts's comment on
// this), since a record button reading as a circle/pill is a strong enough
// convention to break the rule for. Flat solid red fill in both states
// (colors.record, not accent/danger) - no gradient/shadow - a continuous
// subtle "breathing" scale loop while idle (matches the web's
// `mic-breathe` keyframe), adds an expanding/fading pulse ring on top while
// recording (matches `mic-pulse`).
export function MicButton({ recording, onPress, size = 84, shape = "circle", chipWidth, label }: Props) {
	const width = shape === "chip" ? (chipWidth ?? size * 1.9) : size;
	const height = size;
	const cornerRadius = height / 2;
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

	const iconSize = Math.round(height * 0.38);

	return (
		<View style={{ width: width + 32, height: height + 32, alignItems: "center", justifyContent: "center" }}>
			<Animated.View
				style={[
					{ position: "absolute", width, height, borderRadius: cornerRadius, borderWidth: 2, borderColor: colors.record },
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
							width,
							height,
							borderRadius: cornerRadius,
							alignItems: "center",
							justifyContent: "center",
							flexDirection: "row",
							gap: label ? 7 : 0,
							backgroundColor: colors.record,
						}}
					>
						{recording ? (
							<Square size={iconSize} color={colors.onAccent} strokeWidth={2.25} fill={colors.onAccent} />
						) : (
							<Mic size={iconSize} color={colors.onAccent} strokeWidth={2.25} />
						)}
						{label && <Text style={{ color: colors.onAccent, fontFamily: fontFamily.bold, fontSize: Math.round(height * 0.32) }}>{label}</Text>}
					</View>
				</Pressable>
			</Animated.View>
		</View>
	);
}
