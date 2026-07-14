import type { ReactNode } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { PressableScale } from "./PressableScale";
import { colors, radius } from "../theme/tokens";

type Props = {
	children: ReactNode;
	onPress?: () => void;
	disabled?: boolean;
	color?: string;
	style?: StyleProp<ViewStyle>;
	fullWidth?: boolean;
};

// Rounded-square (not pill) flat accent CTA for Done/Organize/share actions
// - part of the app's single consistent shape language (see theme/tokens.ts
// and MicButton.tsx's comments). No gradient, no shadow - flat solid fill
// by design. Full-width by default, but callers that need a compact inline
// variant (e.g. next to the mic button) can pass style/fullWidth={false}.
export function AccentButton({ children, onPress, disabled, color = colors.accent, style, fullWidth = true }: Props) {
	return (
		<PressableScale
			style={[styles.button, { backgroundColor: color }, fullWidth && styles.fullWidth, disabled && styles.disabled, style]}
			onPress={disabled ? undefined : onPress}
			disabled={disabled}
		>
			{children}
		</PressableScale>
	);
}

const styles = StyleSheet.create({
	button: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		paddingVertical: 14,
		paddingHorizontal: 18,
		borderRadius: radius.md,
	},
	fullWidth: {
		width: "100%",
	},
	disabled: {
		opacity: 0.6,
	},
});
