import { forwardRef, useCallback, useMemo } from "react";
import { StyleSheet, Text } from "react-native";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView, type BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import { PressableScale } from "./PressableScale";
import { colors, fontFamily, radius } from "../theme/tokens";

type FrequentItem = { name: string; quantity: string };

type Props = {
	items: FrequentItem[];
	onSelect: (item: FrequentItem) => void;
};

// Opened from RecordCard's plus icon (see RecordingScreen.tsx) - the same
// frequentItems list that used to render as chips in the empty state, now
// also reachable as a sheet at any time, not just before the first item.
export const FrequentItemsSheet = forwardRef<BottomSheetModal, Props>(function FrequentItemsSheet({ items, onSelect }, ref) {
	const snapPoints = useMemo(() => ["50%"], []);
	// No backdrop is rendered by default - without this the sheet floats
	// over the canvas with nothing dimming/blocking the content behind it.
	const renderBackdrop = useCallback(
		(props: BottomSheetBackdropProps) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.5} />,
		[],
	);

	return (
		<BottomSheetModal
			ref={ref}
			snapPoints={snapPoints}
			backgroundStyle={styles.sheetBackground}
			handleIndicatorStyle={styles.handle}
			backdropComponent={renderBackdrop}
		>
			<BottomSheetView style={styles.content}>
				<Text style={styles.title}>அடிக்கடி வாங்கும் பொருட்கள்</Text>
				{items.length === 0 ? (
					<Text style={styles.empty}>இன்னும் போதுமான பட்டியல்கள் இல்லை.</Text>
				) : (
					items.map((item) => (
						<PressableScale key={item.name} style={styles.row} onPress={() => onSelect(item)}>
							<Text style={styles.rowName}>{item.name}</Text>
							<Text style={styles.rowQty}>{item.quantity}</Text>
						</PressableScale>
					))
				)}
			</BottomSheetView>
		</BottomSheetModal>
	);
});

const styles = StyleSheet.create({
	sheetBackground: {
		backgroundColor: colors.surface,
		borderTopLeftRadius: radius.lg,
		borderTopRightRadius: radius.lg,
	},
	handle: {
		backgroundColor: colors.borderStrong,
	},
	content: {
		paddingHorizontal: 18,
		paddingBottom: 24,
		gap: 4,
	},
	title: {
		fontSize: 13,
		fontFamily: fontFamily.extrabold,
		color: colors.textMuted,
		letterSpacing: 0.5,
		textTransform: "uppercase",
		marginBottom: 10,
	},
	empty: {
		fontSize: 13,
		fontFamily: fontFamily.medium,
		color: colors.textMuted,
		textAlign: "center",
		paddingVertical: 20,
	},
	row: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: colors.border,
	},
	rowName: {
		fontSize: 14,
		fontFamily: fontFamily.semibold,
		color: colors.text,
	},
	rowQty: {
		fontSize: 12,
		fontFamily: fontFamily.medium,
		color: colors.textMuted,
	},
});
