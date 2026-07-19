import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BugIcon, CaretRightIcon, GaugeIcon, InfoIcon, NotePencilIcon, QuestionIcon, type Icon } from "phosphor-react-native";
import { PressableScale } from "../components/PressableScale";
import { SettingsPageHeader } from "../components/SettingsPageHeader";
import { colors, fontFamily, radius } from "../theme/tokens";
import type { SettingsRoute } from "./SettingsScreen";

type Props = {
	onClose: () => void;
	onNavigate: (route: Exclude<SettingsRoute, "menu">) => void;
};

// No "Connect account" row here on purpose - hidden per the current request,
// though the screen itself still exists and works (see SettingsScreen's
// initialRoute, used by RecordingScreen's OpenRouter-error recovery path).
// Re-enabling it later is just adding one more entry to this list.
const MENU_ITEMS: Array<{ route: Exclude<SettingsRoute, "menu">; Icon: Icon; label: string }> = [
	{ route: "instructions", Icon: NotePencilIcon, label: "கூடுதல் வழிமுறைகள்" },
	{ route: "usage", Icon: GaugeIcon, label: "பயன்பாடு" },
	{ route: "help", Icon: QuestionIcon, label: "உதவி" },
	{ route: "feedback", Icon: BugIcon, label: "கருத்து / பிழை அறிக்கை" },
	{ route: "about", Icon: InfoIcon, label: "Grocy பற்றி" },
];

export function SettingsMenu({ onClose, onNavigate }: Props) {
	const insets = useSafeAreaInsets();

	return (
		<View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 10 }]}>
			<SettingsPageHeader title="அமைப்புகள்" onBack={onClose} />
			<ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
				<View style={styles.card}>
					{MENU_ITEMS.map((item, i) => (
						<PressableScale
							key={item.route}
							style={[styles.row, i < MENU_ITEMS.length - 1 && styles.rowDivider]}
							onPress={() => onNavigate(item.route)}
						>
							<item.Icon weight="regular" size={18} color={colors.textMuted} />
							<Text style={styles.rowLabel}>{item.label}</Text>
							<CaretRightIcon weight="bold" size={14} color={colors.textMuted} />
						</PressableScale>
					))}
				</View>
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.bg,
		paddingHorizontal: 18,
	},
	scrollContent: {
		paddingBottom: 24,
	},
	card: {
		backgroundColor: colors.surface,
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radius.md,
		paddingHorizontal: 4,
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		paddingHorizontal: 12,
		paddingVertical: 14,
	},
	rowDivider: {
		borderBottomWidth: 1,
		borderStyle: "dashed",
		borderBottomColor: colors.borderStrong,
	},
	rowLabel: {
		flex: 1,
		fontSize: 14,
		fontFamily: fontFamily.semibold,
		color: colors.text,
	},
});
