// Keep in sync with src/client/styles.css's :root tokens - this is a direct
// port of the PWA's already-designed "Claude-esque" palette (warm cream
// paper, one confident terracotta accent, a small "fun" palette for
// category color-coding), not a new design invented for the RN app.
import { Platform } from "react-native";

export const colors = {
	bg: "#f8f5ec",
	surface: "#ffffff",
	surfaceAlt: "#f1ead9",
	border: "#eae1cc",
	borderStrong: "#ddd0af",
	text: "#2b2620",
	textMuted: "#8f8574",

	accent: "#d97757",
	accentStrong: "#bf5e40",
	accentSoft: "#fbe8dd",
	accentGlow: "rgba(217, 119, 87, 0.3)",

	danger: "#dd4b39",
	dangerStrong: "#bd3a2a",
	dangerSoft: "#fce3dd",
	dangerGlow: "rgba(221, 75, 57, 0.3)",

	// The mic button's own color, distinct from `danger` - a record button
	// reads as red at all times (not just while actively recording), matching
	// common voice-recorder conventions rather than the app's accent color.
	record: "#dc2626",

	fun: {
		coral: "#d97757",
		gold: "#e3a23d",
		sage: "#6e9b72",
		blue: "#5a8fb5",
		berry: "#b65c7a",
		violet: "#8b7ec8",
	},

	whatsapp: "#25d366",

	onAccent: "#fff8f2",
} as const;

// Shape system: rounded-square everywhere, no circles or pills, applied by
// role rather than freehanded per component - `sm` for surfaces (cards,
// item rows, checkboxes), `md` for every interactive control (buttons,
// icon buttons, the mic button). A flat pixel radius reads as "more
// rounded" on a small element than a large one, so MicButton computes its
// own corner radius proportionally instead of using `md` directly - but
// it's tuned to land at roughly the same *visual* roundedness as `md` does
// on a typical ~48px button, so the two families still read as one system.
// `pill` is kept only for the quick-add chips, a deliberately distinct
// "tag" affordance (same split Material Design makes between chips and
// buttons) - not used for anything else. MicButton is the one other
// deliberate exception - fully circular, not computed from this scale at
// all (see its own cornerRadius comment) - a record button reading as a
// circle is a strong enough convention to break the rounded-square rule for.
export const radius = {
	sm: 12,
	md: 18,
	lg: 28,
	pill: 999,
} as const;

// RN has no single cross-platform "box-shadow" - shadowColor/Offset/Opacity/
// Radius drive iOS (and modern Android via the same style properties in
// recent RN versions), elevation is the Android fallback for older RN. Both
// are included so the shadow reads consistently.
export const shadow = {
	sm: {
		shadowColor: "#2b2620",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.08,
		shadowRadius: 3,
		elevation: 2,
	},
	md: {
		shadowColor: "#2b2620",
		shadowOffset: { width: 0, height: 8 },
		shadowOpacity: 0.1,
		shadowRadius: 16,
		elevation: 6,
	},
	lg: {
		shadowColor: "#2b2620",
		shadowOffset: { width: 0, height: 16 },
		shadowOpacity: 0.14,
		shadowRadius: 28,
		elevation: 12,
	},
} as const;

export const duration = {
	fast: 140,
	base: 240,
} as const;

// The CSS bounce easing (cubic-bezier(.34,1.56,.64,1)) is a spring-with-
// overshoot curve - reanimated's withSpring with these params produces the
// closest equivalent feel (a slight overshoot before settling).
export const spring = {
	damping: 11,
	stiffness: 180,
	mass: 0.6,
} as const;

export const fontFamily = {
	regular: "MuktaMalar_400Regular",
	medium: "MuktaMalar_500Medium",
	semibold: "MuktaMalar_600SemiBold",
	bold: "MuktaMalar_700Bold",
	extrabold: "MuktaMalar_800ExtraBold",
} as const;

export const iconStyle = {
	default: "linear",
	active: "bold",
} as const;

// Android-only project (no iOS testing in scope) - kept as a guard rather
// than assumed, in case this ever runs on iOS during development.
export const isAndroid = Platform.OS === "android";

// Lightweight tint for coloring icon-button backgrounds from the fun
// palette without needing a pre-baked "soft" variant of every color.
export function withOpacity(hex: string, alpha: number): string {
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
