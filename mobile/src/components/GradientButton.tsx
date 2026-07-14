import type { ReactNode } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { PressableScale } from "./PressableScale";
import { colors, radius, shadow } from "../theme/tokens";

type Props = {
	children: ReactNode;
	onPress?: () => void;
	disabled?: boolean;
	colorsPair?: [string, string];
	style?: StyleProp<ViewStyle>;
	fullWidth?: boolean;
};

// Rounded-square (not pill) accent-gradient CTA for Done/Organize/share
// actions - part of the app's single consistent shape language (see
// theme/tokens.ts and MicButton.tsx's comments). Full-width by default, but
// callers that need a compact inline variant (e.g. next to the mic button)
// can pass style/fullWidth={false}.
export function GradientButton({ children, onPress, disabled, colorsPair = [colors.fun.gold, colors.accentStrong], style, fullWidth = true }: Props) {
	return (
		<PressableScale
			style={[styles.wrapper, fullWidth && styles.fullWidth, disabled && styles.disabled, style]}
			onPress={disabled ? undefined : onPress}
			disabled={disabled}
		>
			<LinearGradient colors={colorsPair} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.gradient}>
				{children}
			</LinearGradient>
		</PressableScale>
	);
}

const styles = StyleSheet.create({
	wrapper: {
		borderRadius: radius.md,
		// Android only renders elevation-based shadow reliably when the same
		// view also has an opaque backgroundColor - without it the shadow can
		// end up invisible even though elevation is set correctly. The actual
		// visible fill still comes from the LinearGradient child on top.
		backgroundColor: colors.accentStrong,
		...shadow.md,
	},
	fullWidth: {
		width: "100%",
	},
	gradient: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		paddingVertical: 14,
		paddingHorizontal: 18,
		borderRadius: radius.md,
	},
	disabled: {
		opacity: 1,
	},
});
