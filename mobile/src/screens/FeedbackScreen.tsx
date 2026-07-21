import { Linking, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Mail } from "lucide-react-native";
import { AccentButton } from "../components/AccentButton";
import { SettingsPageHeader } from "../components/SettingsPageHeader";
import { colors, fontFamily } from "../theme/tokens";

type Props = {
	onBack: () => void;
};

const FEEDBACK_EMAIL = "contact@grocy.store";

function handleSendFeedback() {
	Linking.openURL(`mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent("Grocy feedback")}`);
}

export function FeedbackScreen({ onBack }: Props) {
	const insets = useSafeAreaInsets();

	return (
		<View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 10 }]}>
			<SettingsPageHeader title="கருத்து / பிழை அறிக்கை" onBack={onBack} />
			<View style={styles.content}>
				<Text style={styles.note}>
					ஏதேனும் பிழை கண்டீர்களா, அல்லது ஒரு யோசனை இருக்கிறதா? கீழே உள்ள பொத்தானை அழுத்தி மின்னஞ்சல் அனுப்புங்கள் - நேரடியாக பார்க்கிறோம்.
				</Text>
				<AccentButton onPress={handleSendFeedback}>
					<Mail size={16} color={colors.onAccent} strokeWidth={2.25} />
					<Text style={styles.buttonText}>மின்னஞ்சல் அனுப்பு</Text>
				</AccentButton>
				<Text style={styles.emailNote}>{FEEDBACK_EMAIL}</Text>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.bg,
		paddingHorizontal: 18,
	},
	content: {
		gap: 14,
	},
	note: {
		fontSize: 13,
		fontFamily: fontFamily.medium,
		color: colors.text,
		lineHeight: 19,
	},
	buttonText: {
		color: colors.onAccent,
		fontFamily: fontFamily.bold,
		fontSize: 14,
	},
	emailNote: {
		textAlign: "center",
		fontSize: 12,
		fontFamily: fontFamily.medium,
		color: colors.textMuted,
	},
});
