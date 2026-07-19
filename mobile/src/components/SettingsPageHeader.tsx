import { StatusBar, StyleSheet, Text, View } from "react-native";
import { ArrowLeftIcon } from "phosphor-react-native";
import { PressableScale } from "./PressableScale";
import { colors, fontFamily } from "../theme/tokens";

type Props = {
	title: string;
	onBack: () => void;
};

// Shared back-arrow + title row for the Settings menu and every subpage -
// same markup the single-page SettingsScreen used to own directly, now
// extracted since every page under Settings/ repeats it identically.
export function SettingsPageHeader({ title, onBack }: Props) {
	return (
		<>
			<StatusBar barStyle="dark-content" />
			<View style={styles.header}>
				<PressableScale onPress={onBack} style={styles.backButton}>
					<ArrowLeftIcon weight="bold" size={18} color={colors.text} />
				</PressableScale>
				<Text style={styles.title}>{title}</Text>
				<View style={styles.backButton} />
			</View>
		</>
	);
}

const styles = StyleSheet.create({
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: 14,
	},
	backButton: {
		width: 32,
		height: 32,
		alignItems: "center",
		justifyContent: "center",
	},
	title: {
		fontSize: 17,
		fontFamily: fontFamily.extrabold,
		color: colors.text,
	},
});
