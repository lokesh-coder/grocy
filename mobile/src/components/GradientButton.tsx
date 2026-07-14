import type { ReactNode } from "react";
import { StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { PressableScale } from "./PressableScale";
import { colors, radius, shadow } from "../theme/tokens";

type Props = {
	children: ReactNode;
	onPress?: () => void;
	disabled?: boolean;
	colorsPair?: [string, string];
};

// The pill-shaped accent-gradient CTA used for Done/Organize/share actions
// on the web app (`.done-button`/`.organize-button`) - full-width, gradient
// fill, soft glow shadow, press-bounce.
export function GradientButton({ children, onPress, disabled, colorsPair = [colors.accent, colors.accentStrong] }: Props) {
	return (
		<PressableScale style={[styles.wrapper, disabled && styles.disabled]} onPress={disabled ? undefined : onPress} disabled={disabled}>
			<LinearGradient colors={colorsPair} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.gradient}>
				{children}
			</LinearGradient>
		</PressableScale>
	);
}

const styles = StyleSheet.create({
	wrapper: {
		width: "100%",
		borderRadius: radius.pill,
		...shadow.md,
	},
	gradient: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		paddingVertical: 14,
		borderRadius: radius.pill,
	},
	disabled: {
		opacity: 1,
	},
});
