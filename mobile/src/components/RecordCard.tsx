import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { interpolate, interpolateColor, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import Svg, { Defs, Path, Pattern, Rect } from "react-native-svg";
import { Plus, Star } from "lucide-react-native";
import { MicButton } from "./MicButton";
import { PressableScale } from "./PressableScale";
import { colors, fontFamily, radius } from "../theme/tokens";

type Props = {
	segments: string[];
	listening: boolean;
	onToggleRecord: () => void;
	onOpenFrequent: () => void;
	onClear: () => void;
};

const CARD_RADIUS = radius.md;
const PREVIEW_COLLAPSED_HEIGHT = 38;
const PREVIEW_EXPANDED_HEIGHT = 160;
// Bigger than PREVIEW_EXPANDED_HEIGHT on purpose - the stripe layer is a
// fixed-size canvas that always fully covers the tallest possible preview
// state, clipped by the parent's overflow:hidden to whatever height is
// currently visible. An SVG sized purely from style (percentage/absoluteFill)
// doesn't reliably re-measure itself as a Reanimated-driven height animates -
// it stays stuck at whatever size it first rendered at instead of growing
// with the animation, which is why this exists as a fixed oversized layer
// instead of trying to track the live height.
const STRIPE_LAYER_HEIGHT = PREVIEW_EXPANDED_HEIGHT + 40;

// The one persistent control surface on the recording screen - never
// swapped out for a different row depending on state (see
// RecordingScreen.tsx removing the old stopped-vs-recording row swap). Row
// 1 is a live preview of what was just said (tap to expand and see/scroll
// the full transcript); row 2 is plus (frequent items) / record (always
// toggles listening, whatever the state) / clear - all three always
// present together, clustered close so a thumb can reach all three without
// stretching.
export function RecordCard({ segments, listening, onToggleRecord, onOpenFrequent, onClear }: Props) {
	// No border, background always white - "recording" is conveyed by the
	// shadow tinting toward colors.record and growing slightly, not by
	// swapping the card's own colors (see the card's shadow props below).
	const pulse = useSharedValue(0);
	const [expanded, setExpanded] = useState(false);
	const expandProgress = useSharedValue(0);

	useEffect(() => {
		if (listening) {
			pulse.value = withRepeat(withSequence(withTiming(1, { duration: 900 }), withTiming(0.55, { duration: 900 })), -1, true);
		} else {
			pulse.value = withTiming(0, { duration: 200 });
		}
	}, [listening, pulse]);

	useEffect(() => {
		expandProgress.value = withTiming(expanded ? 1 : 0, { duration: 220 });
	}, [expanded, expandProgress]);

	const animatedCardStyle = useAnimatedStyle(() => ({
		shadowColor: interpolateColor(pulse.value, [0, 1], ["#2b2620", colors.record]),
		shadowOpacity: interpolate(pulse.value, [0, 1], [0.08, 0.28]),
		shadowRadius: interpolate(pulse.value, [0, 1], [10, 16]),
	}));

	const animatedPreviewStyle = useAnimatedStyle(() => ({
		height: interpolate(expandProgress.value, [0, 1], [PREVIEW_COLLAPSED_HEIGHT, PREVIEW_EXPANDED_HEIGHT]),
	}));

	const recentSegments = segments.slice(-2);

	return (
		<Animated.View style={[styles.card, animatedCardStyle]}>
			<Pressable onPress={() => setExpanded((e) => !e)}>
				<Animated.View style={[styles.previewRow, animatedPreviewStyle]}>
					<DiagonalStripes />
					{expanded ? (
						<ScrollView showsVerticalScrollIndicator={false} style={styles.previewScroll}>
							{segments.length > 0 ? (
								segments.map((segment, i) => (
									<Text key={`${i}-${segment}`} style={styles.previewTextExpanded}>
										{segment}
									</Text>
								))
							) : (
								<Text style={styles.previewPlaceholder}>பேசுங்கள்…</Text>
							)}
						</ScrollView>
					) : recentSegments.length > 0 ? (
						recentSegments.map((segment, i) => (
							<Text key={`${i}-${segment}`} style={styles.previewText} numberOfLines={1}>
								{segment}
							</Text>
						))
					) : (
						<Text style={styles.previewPlaceholder}>பேசுங்கள்…</Text>
					)}
				</Animated.View>
			</Pressable>
			<View style={styles.controlsRow}>
				<PressableScale onPress={onOpenFrequent} style={styles.sideButton} accessibilityLabel="அடிக்கடி வாங்கும் பொருட்கள்">
					<Star size={18} color={colors.textMuted} strokeWidth={2.25} />
				</PressableScale>
				<MicButton recording={listening} onPress={onToggleRecord} size={40} shape="chip" chipWidth={104} label="பேசு" />
				<PressableScale onPress={onClear} style={styles.sideButton} accessibilityLabel="புதியது">
					<Plus size={20} color={colors.textMuted} strokeWidth={2.25} />
				</PressableScale>
			</View>
		</Animated.View>
	);
}

// A repeating 45°-rotated line pattern via react-native-svg (already a
// dependency, pulled in by the icon set) - sits behind the preview text as
// its background instead of a flat tint, per the "diagonal striped" look
// asked for. Fixed-size, absolutely positioned, clipped by the parent's
// overflow:hidden (see STRIPE_LAYER_HEIGHT above) rather than trying to
// resize itself. Purely decorative, so it's excluded from touch handling.
function DiagonalStripes() {
	return (
		<Svg style={styles.stripeLayer} pointerEvents="none">
			<Defs>
				<Pattern id="grocyDiagonalStripes" patternUnits="userSpaceOnUse" width={6} height={6} patternTransform="rotate(45)">
					<Rect width={6} height={6} fill={colors.surfaceAlt} />
					<Path d="M0,0 L0,6" stroke={colors.border} strokeWidth={2.5} />
				</Pattern>
			</Defs>
			<Rect width="100%" height="100%" fill="url(#grocyDiagonalStripes)" />
		</Svg>
	);
}

const styles = StyleSheet.create({
	card: {
		width: "100%",
		borderRadius: CARD_RADIUS,
		backgroundColor: colors.surface,
		overflow: "hidden",
		shadowColor: "#2b2620",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.08,
		shadowRadius: 10,
		elevation: 4,
	},
	// A small offset from the card's own edges (not flush anymore) - needs
	// its own borderRadius now that it's not relying on the card's
	// overflow:hidden to shape its corners, matching CARD_RADIUS so the two
	// read as one consistent shape language rather than a rectangle inside
	// a rounder one.
	previewRow: {
		justifyContent: "center",
		paddingHorizontal: 12,
		margin: 8,
		borderRadius: CARD_RADIUS,
		overflow: "hidden",
	},
	stripeLayer: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		height: STRIPE_LAYER_HEIGHT,
	},
	previewScroll: {
		flex: 1,
	},
	// fontFamily.regular (400) is the lightest weight this app loads (see
	// theme/useAppFonts.ts) - not combined with a separate fontWeight prop,
	// since that can conflict with how a specific named custom font variant
	// gets matched on Android.
	previewText: {
		fontSize: 12,
		fontFamily: fontFamily.regular,
		color: colors.textMuted,
		fontStyle: "italic",
		textAlign: "center",
	},
	previewTextExpanded: {
		fontSize: 12,
		fontFamily: fontFamily.regular,
		color: colors.textMuted,
		fontStyle: "italic",
		paddingVertical: 3,
		textAlign: "center",
	},
	previewPlaceholder: {
		fontSize: 12,
		fontFamily: fontFamily.regular,
		color: colors.textMuted,
		fontStyle: "italic",
		opacity: 0.6,
		textAlign: "center",
	},
	// Centered with a tight gap, not space-between - plus/clear sit right up
	// against the record chip so a thumb reaches all three without
	// stretching across the card.
	controlsRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 10,
		paddingTop: 2,
		paddingBottom: 4,
	},
	// Rounded light-gray chip behind the side buttons, distinct from the
	// record chip's own red fill - gives them a tappable, button-like
	// presence instead of bare icons floating next to the mic.
	sideButton: {
		width: 38,
		height: 38,
		borderRadius: 19,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: colors.surfaceAlt,
	},
});
