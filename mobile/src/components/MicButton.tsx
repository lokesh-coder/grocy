import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
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
};

const SIZE = 84;

// Circular mic button - accent gradient with a continuous subtle "breathing"
// scale loop while idle (matches the web's `mic-breathe` keyframe), switches
// to a danger gradient with an expanding/fading pulse ring while recording
// (matches `mic-pulse`, which animates a growing box-shadow ring - RN can't
// animate shadow spread smoothly on Android, so this is a separate ring
// view instead, same visual read).
export function MicButton({ recording, onPress }: Props) {
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
		<View style={styles.container}>
			<Animated.View style={[styles.ring, ringStyle]} />
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
						colors={recording ? [colors.danger, colors.dangerStrong] : [colors.accent, colors.accentStrong]}
						start={{ x: 0.15, y: 0 }}
						end={{ x: 0.85, y: 1 }}
						style={styles.button}
					>
						<SolarIcon name={recording ? "Stop" : "Microphone"} type="bold" size={32} color={colors.onAccent} />
					</LinearGradient>
				</Pressable>
			</Animated.View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		width: SIZE + 40,
		height: SIZE + 40,
		alignItems: "center",
		justifyContent: "center",
	},
	ring: {
		position: "absolute",
		width: SIZE,
		height: SIZE,
		borderRadius: SIZE / 2,
		borderWidth: 2,
		borderColor: colors.danger,
	},
	button: {
		width: SIZE,
		height: SIZE,
		borderRadius: SIZE / 2,
		alignItems: "center",
		justifyContent: "center",
		...shadow.md,
	},
});
