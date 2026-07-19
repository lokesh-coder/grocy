import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SettingsPageHeader } from "../components/SettingsPageHeader";
import { colors, fontFamily, radius } from "../theme/tokens";

type Props = {
	onBack: () => void;
};

const HELP_SECTIONS: Array<{ title: string; body: string }> = [
	{
		title: "எப்படி பயன்படுத்துவது",
		body: 'மைக் பொத்தானை அழுத்தி, தமிழில் பேசுங்கள் - தயங்கினாலும், திருத்தினாலும், மனது மாறினாலும் பரவாயில்லை. பட்டியல் பேசும்போதே தானாகத் தயாராகும். முடிந்ததும் மைக் பொத்தானை மீண்டும் அழுத்தவும் - "தொடரவும்", "பகிரவும்", "புதியது" பொத்தான்கள் தோன்றும். வேண்டுமானால் "வகைப்படுத்தி விலை காட்டு"-வை அழுத்தி, பொருட்களை வகைப்படி பிரித்து, மதிப்பீட்டு விலையையும் பார்க்கலாம். "தொடரவும்" அழுத்தி பேச்சைத் தொடரலாம், அல்லது WhatsApp-லோ வேறு எங்காவதோ பகிரலாம்.',
	},
	{
		title: "கணக்கு தேவையா?",
		body: "வேண்டாம் - முதல் முறை பட்டியல் உருவாக்கும்போதே ஒரு இலவச திட்டம் தானாக இயங்கும், எந்த கணக்கும் தேவையில்லை. இந்த ஆப்பில் சொந்த சேவையகம் (server) கிடையாது - பட்டியலைப் புரிந்துகொள்ள ஒரு AI மாடலுக்கு (OpenRouter) நேரடியாக அழைப்பு செல்லும், உங்கள் தரவு நடுவில் யாரையும் கடக்காது.",
	},
	{
		title: "இலவச திட்டம் முடிந்துவிட்டால்?",
		body: "இலவச திட்டம் ஒவ்வொரு மாதமும் தானாக புதுப்பிக்கப்படும். இடையில் முடிந்துவிட்டால், அமைப்புகளில் இருந்து உங்கள் சொந்த OpenRouter கணக்கை (இலவசமாகத் தொடங்கலாம்) இணைத்து வரம்பின்றி தொடரலாம். ஒரு பட்டியலுக்கு ஒரு ரூபாய்க்கும் குறைவே ஆகும்.",
	},
	{
		title: "மைக் வேலை செய்யவில்லையா?",
		body: "மைக்ரோஃபோன் அனுமதி மறுக்கப்பட்டிருந்தால், Android அமைப்புகள் → Apps → மளிகை பட்டியல் → Permissions-ல் மைக்ரோஃபோனை இயக்கவும். எதுவும் பேசாமல் சில நொடிகள் இருந்தால் தானாக பதிவு நிற்கும் - அது தவறு இல்லை.",
	},
];

export function HelpScreen({ onBack }: Props) {
	const insets = useSafeAreaInsets();

	return (
		<View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 10 }]}>
			<SettingsPageHeader title="உதவி" onBack={onBack} />
			<ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
				<View style={styles.card}>
					{HELP_SECTIONS.map((section, i) => (
						<View key={section.title} style={[styles.helpSection, i > 0 && styles.helpSectionSpacing]}>
							<Text style={styles.helpTitle}>{section.title}</Text>
							<Text style={styles.helpBody}>{section.body}</Text>
						</View>
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
		padding: 14,
		gap: 10,
	},
	helpSection: {
		gap: 3,
	},
	helpSectionSpacing: {
		marginTop: 10,
	},
	helpTitle: {
		fontSize: 13,
		fontFamily: fontFamily.extrabold,
		color: colors.accent,
	},
	helpBody: {
		fontSize: 12,
		fontFamily: fontFamily.medium,
		color: colors.text,
		lineHeight: 18,
	},
});
