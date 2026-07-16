import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { XIcon } from "phosphor-react-native";
import { PressableScale } from "./PressableScale";
import { colors, fontFamily, radius } from "../theme/tokens";

type Props = {
	visible: boolean;
	onClose: () => void;
};

const SECTIONS: Array<{ title: string; body: string }> = [
	{
		title: "எப்படி பயன்படுத்துவது",
		body: "மைக் பொத்தானை அழுத்தி, தமிழில் பேசுங்கள் - தயங்கினாலும், திருத்தினாலும், மனது மாறினாலும் பரவாயில்லை. முடிந்ததும் \"முடிந்தது\" (✓) பொத்தானை அழுத்தவும். பட்டியல் தயார். வேண்டுமானால் \"வகைப்படுத்தி விலை காட்டு\"-வை அழுத்தி, பொருட்களை வகைப்படி பிரித்து, மதிப்பீட்டு விலையையும் பார்க்கலாம். இறுதியாக WhatsApp-லோ வேறு எங்காவதோ பகிரலாம்.",
	},
	{
		title: "OpenRouter ஏன் தேவை?",
		body: "பேசியதை பட்டியலாக மாற்றவும், வகைப்படுத்தவும், விலை மதிப்பிடவும் ஒரு AI மாடல் தேவை. இந்த ஆப்பில் அதற்கான சேவையகம் (server) கிடையாது - உங்கள் OpenRouter கணக்கை நேரடியாக இணைத்து, அந்தக் கணக்கிலிருந்தே இந்த அழைப்புகள் நடக்கும். உங்கள் தரவு எந்த நடுவர் சேவையகத்தையும் கடந்து செல்லாது.",
	},
	{
		title: "இது எவ்வளவு செலவாகும்?",
		body: "OpenRouter-ல் கணக்கு தொடங்குவது இலவசம். சில டாலர் கிரெடிட் சேர்த்தால் போதும் - ஒரு பட்டியலுக்கு ஒரு ரூபாய்க்கும் குறைவே ஆகும் (அமைப்புகளில் Gemini Flash / Flash Lite தேர்ந்தெடுத்தால் இன்னும் குறைவு). அமைப்புகள் (⚙️) → OpenRouter கணக்கை இணை என்பதில் தொடங்கலாம்.",
	},
	{
		title: "மைக் வேலை செய்யவில்லையா?",
		body: "மைக்ரோஃபோன் அனுமதி மறுக்கப்பட்டிருந்தால், Android அமைப்புகள் → Apps → மளிகை பட்டியல் → Permissions-ல் மைக்ரோஃபோனை இயக்கவும். எதுவும் பேசாமல் சில நொடிகள் இருந்தால் தானாக பதிவு நிற்கும் - அது தவறு இல்லை.",
	},
];

// Same modal pattern as SettingsModal - a single scrollable card, no
// separate route, since the app is intentionally a single screen.
export function HelpModal({ visible, onClose }: Props) {
	return (
		<Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
			<Pressable style={styles.backdrop} onPress={onClose}>
				<Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
					<View style={styles.header}>
						<Text style={styles.title}>உதவி</Text>
						<PressableScale onPress={onClose} style={styles.closeButton}>
							<XIcon weight="bold" size={16} color={colors.textMuted} />
						</PressableScale>
					</View>
					<ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
						{SECTIONS.map((section) => (
							<View key={section.title} style={styles.section}>
								<Text style={styles.sectionTitle}>{section.title}</Text>
								<Text style={styles.sectionBody}>{section.body}</Text>
							</View>
						))}
					</ScrollView>
				</Pressable>
			</Pressable>
		</Modal>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		backgroundColor: "rgba(43, 38, 32, 0.4)",
		justifyContent: "center",
		alignItems: "center",
		padding: 24,
	},
	card: {
		width: "100%",
		maxWidth: 360,
		maxHeight: "80%",
		backgroundColor: colors.surface,
		borderRadius: radius.md,
		padding: 16,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: 8,
	},
	title: {
		fontSize: 15,
		fontFamily: fontFamily.extrabold,
		color: colors.text,
	},
	closeButton: {
		width: 28,
		height: 28,
		borderRadius: radius.sm,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: colors.surfaceAlt,
	},
	scroll: {
		flexGrow: 0,
	},
	section: {
		marginBottom: 16,
	},
	sectionTitle: {
		fontSize: 13,
		fontFamily: fontFamily.extrabold,
		color: colors.accent,
		marginBottom: 4,
	},
	sectionBody: {
		fontSize: 13,
		fontFamily: fontFamily.medium,
		color: colors.text,
		lineHeight: 19,
	},
});
