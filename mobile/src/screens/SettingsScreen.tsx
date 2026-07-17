import { useEffect, useState } from "react";
import { Linking, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
	ArrowLeftIcon,
	CheckCircleIcon,
	GlobeIcon,
	GithubLogoIcon,
	LinkBreakIcon,
	LinkSimpleIcon,
	NotePencilIcon,
	QuestionIcon,
	ShieldCheckIcon,
} from "phosphor-react-native";
import { PressableScale } from "../components/PressableScale";
import { AccentButton } from "../components/AccentButton";
import { LoaderDots } from "../components/LoaderDots";
import { MODEL_OPTIONS } from "../lib/models";
import { getCustomInstructions, setCustomInstructions } from "../lib/customInstructions";
import { colors, fontFamily, radius } from "../theme/tokens";
import appJson from "../../app.json";

type Props = {
	onClose: () => void;
	selectedModel: string;
	onSelectModel: (id: string) => void;
	connected: boolean;
	isAuto: boolean;
	connecting: boolean;
	onConnect: () => void;
	onDisconnect: () => void;
};

const HELP_SECTIONS: Array<{ title: string; body: string }> = [
	{
		title: "எப்படி பயன்படுத்துவது",
		body: 'மைக் பொத்தானை அழுத்தி, தமிழில் பேசுங்கள் - தயங்கினாலும், திருத்தினாலும், மனது மாறினாலும் பரவாயில்லை. முடிந்ததும் "முடிந்தது" (✓) பொத்தானை அழுத்தவும். பட்டியல் தயார். வேண்டுமானால் "வகைப்படுத்தி விலை காட்டு"-வை அழுத்தி, பொருட்களை வகைப்படி பிரித்து, மதிப்பீட்டு விலையையும் பார்க்கலாம். இறுதியாக WhatsApp-லோ வேறு எங்காவதோ பகிரலாம்.',
	},
	{
		title: "கணக்கு தேவையா?",
		body: "வேண்டாம் - முதல் முறை பட்டியல் உருவாக்கும்போதே ஒரு இலவச திட்டம் தானாக இயங்கும், எந்த கணக்கும் தேவையில்லை. இந்த ஆப்பில் சொந்த சேவையகம் (server) கிடையாது - பட்டியலைப் புரிந்துகொள்ள ஒரு AI மாடலுக்கு (OpenRouter) நேரடியாக அழைப்பு செல்லும், உங்கள் தரவு நடுவில் யாரையும் கடக்காது.",
	},
	{
		title: "இலவச திட்டம் முடிந்துவிட்டால்?",
		body: "இலவச திட்டம் ஒவ்வொரு மாதமும் தானாக புதுப்பிக்கப்படும். இடையில் முடிந்துவிட்டால், கீழே 'சொந்த கணக்கை இணை' என்பதில், உங்கள் சொந்த OpenRouter கணக்கை (இலவசமாகத் தொடங்கலாம்) இணைத்து வரம்பின்றி தொடரலாம். ஒரு பட்டியலுக்கு ஒரு ரூபாய்க்கும் குறைவே ஆகும்.",
	},
	{
		title: "மைக் வேலை செய்யவில்லையா?",
		body: "மைக்ரோஃபோன் அனுமதி மறுக்கப்பட்டிருந்தால், Android அமைப்புகள் → Apps → மளிகை பட்டியல் → Permissions-ல் மைக்ரோஃபோனை இயக்கவும். எதுவும் பேசாமல் சில நொடிகள் இருந்தால் தானாக பதிவு நிற்கும் - அது தவறு இல்லை.",
	},
];

export function SettingsScreen({
	onClose,
	selectedModel,
	onSelectModel,
	connected,
	isAuto,
	connecting,
	onConnect,
	onDisconnect,
}: Props) {
	const insets = useSafeAreaInsets();
	const [instructions, setInstructions] = useState("");
	const [savedInstructions, setSavedInstructions] = useState("");

	useEffect(() => {
		getCustomInstructions().then((value) => {
			setInstructions(value);
			setSavedInstructions(value);
		});
	}, []);

	async function handleBlurInstructions() {
		if (instructions === savedInstructions) return;
		await setCustomInstructions(instructions);
		setSavedInstructions(instructions);
	}

	return (
		<View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 10 }]}>
			<StatusBar barStyle="dark-content" />
			<View style={styles.header}>
				<PressableScale onPress={onClose} style={styles.backButton}>
					<ArrowLeftIcon weight="bold" size={18} color={colors.text} />
				</PressableScale>
				<Text style={styles.title}>அமைப்புகள்</Text>
				<View style={styles.backButton} />
			</View>

			<ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
				{/* Plan / connect */}
				<Text style={styles.sectionLabel}>திட்டம்</Text>
				<View style={styles.card}>
					{connected && !isAuto && (
						<View style={styles.connectedRow}>
							<View style={styles.connectedBadge}>
								<CheckCircleIcon weight="fill" size={16} color={colors.fun.sage} />
								<Text style={styles.connectedText}>சொந்த கணக்கு இணைக்கப்பட்டது · வரம்பின்றி</Text>
							</View>
							<PressableScale onPress={onDisconnect} style={styles.disconnectButton}>
								<LinkBreakIcon weight="regular" size={14} color={colors.danger} />
								<Text style={styles.disconnectText}>துண்டி</Text>
							</PressableScale>
						</View>
					)}
					{connected && isAuto && (
						<>
							<View style={styles.connectedRow}>
								<View style={styles.connectedBadge}>
									<CheckCircleIcon weight="fill" size={16} color={colors.accent} />
									<Text style={styles.connectedText}>இலவச திட்டம் பயன்பாட்டில்</Text>
								</View>
							</View>
							<Text style={styles.cardNote}>
								மாதம்தோறும் இலவசமாக புதுப்பிக்கப்படும். வரம்பு முடிந்தால், உங்கள் சொந்த கணக்கை இணைத்து வரம்பின்றி தொடரலாம்.
							</Text>
							<PressableScale onPress={onConnect} disabled={connecting} style={styles.upgradeButton}>
								{connecting ? (
									<LoaderDots variant="fun" />
								) : (
									<>
										<LinkSimpleIcon weight="bold" size={14} color={colors.accent} />
										<Text style={styles.upgradeButtonText}>சொந்த கணக்கை இணை</Text>
									</>
								)}
							</PressableScale>
						</>
					)}
					{!connected && (
						<AccentButton onPress={onConnect} disabled={connecting}>
							{connecting ? (
								<LoaderDots variant="onAccent" />
							) : (
								<>
									<LinkSimpleIcon weight="bold" size={16} color={colors.onAccent} />
									<Text style={styles.connectButtonText}>OpenRouter கணக்கை இணை</Text>
								</>
							)}
						</AccentButton>
					)}
				</View>

				{/* Model */}
				<Text style={styles.sectionLabel}>மாடல்</Text>
				<View style={styles.card}>
					{MODEL_OPTIONS.map((option, i) => {
						const selected = option.id === selectedModel;
						return (
							<PressableScale
								key={option.id}
								style={[styles.option, i > 0 && styles.optionSpacing, selected && styles.optionSelected]}
								onPress={() => onSelectModel(option.id)}
							>
								<View style={styles.optionText}>
									<Text style={styles.optionLabel}>{option.label}</Text>
									<Text style={styles.optionDescription}>{option.description}</Text>
								</View>
								{selected && <CheckCircleIcon weight="fill" size={20} color={colors.accent} />}
							</PressableScale>
						);
					})}
				</View>

				{/* Custom instructions */}
				<View style={styles.sectionLabelRow}>
					<NotePencilIcon weight="bold" size={12} color={colors.textMuted} />
					<Text style={styles.sectionLabel}>கூடுதல் வழிமுறைகள்</Text>
				</View>
				<View style={styles.card}>
					<Text style={styles.cardNote}>
						பட்டியல் புரிந்துகொள்ளும்போது Grocy கவனிக்க வேண்டிய சிறப்பு விஷயங்கள் இருந்தால் இங்கே எழுதுங்கள் (உதாரணம்: ஒரு பொருளின் பெயரை
						தவறாகப் புரிந்துகொள்கிறது, அல்லது ஒரு அலகை நீங்கள் வேறு விதமாக விரும்புகிறீர்கள்).
					</Text>
					<TextInput
						style={styles.instructionsInput}
						value={instructions}
						onChangeText={setInstructions}
						onBlur={handleBlurInstructions}
						multiline
						placeholder="உதாரணம்: 'மாங்காய்' என்றால் எப்போதும் பச்சை மாங்காயைத்தான் சொல்கிறேன்."
						placeholderTextColor={colors.textMuted}
					/>
				</View>

				{/* Help */}
				<View style={styles.sectionLabelRow}>
					<QuestionIcon weight="bold" size={12} color={colors.textMuted} />
					<Text style={styles.sectionLabel}>உதவி</Text>
				</View>
				<View style={styles.card}>
					{HELP_SECTIONS.map((section, i) => (
						<View key={section.title} style={[styles.helpSection, i > 0 && styles.optionSpacing]}>
							<Text style={styles.helpTitle}>{section.title}</Text>
							<Text style={styles.helpBody}>{section.body}</Text>
						</View>
					))}
				</View>

				{/* About */}
				<Text style={styles.sectionLabel}>Grocy பற்றி</Text>
				<View style={styles.card}>
					<Text style={styles.cardNote}>
						குரல் மூலம் தமிழில் மளிகை பட்டியல் உருவாக்க உதவும் ஆப். சொந்த சேவையகம் இல்லை, விளம்பரங்கள் இல்லை.
					</Text>
					<PressableScale style={styles.linkRow} onPress={() => Linking.openURL("https://grocy.store")}>
						<GlobeIcon weight="regular" size={15} color={colors.accent} />
						<Text style={styles.linkText}>grocy.store</Text>
					</PressableScale>
					<PressableScale style={styles.linkRow} onPress={() => Linking.openURL("https://grocy.store/privacy")}>
						<ShieldCheckIcon weight="regular" size={15} color={colors.accent} />
						<Text style={styles.linkText}>தனியுரிமைக் கொள்கை</Text>
					</PressableScale>
					<PressableScale style={styles.linkRow} onPress={() => Linking.openURL("https://github.com/lokesh-coder/grocy")}>
						<GithubLogoIcon weight="regular" size={15} color={colors.accent} />
						<Text style={styles.linkText}>GitHub</Text>
					</PressableScale>
				</View>

				<Text style={styles.version}>Grocy v{appJson.expo.version}</Text>
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
	scrollContent: {
		paddingBottom: 24,
	},
	sectionLabel: {
		fontSize: 11,
		fontFamily: fontFamily.extrabold,
		letterSpacing: 0.5,
		textTransform: "uppercase",
		color: colors.textMuted,
		marginBottom: 8,
		marginTop: 18,
	},
	sectionLabelRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 5,
		marginTop: 18,
		marginBottom: 8,
	},
	card: {
		backgroundColor: colors.surface,
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radius.md,
		padding: 14,
		gap: 10,
	},
	cardNote: {
		fontSize: 12,
		fontFamily: fontFamily.medium,
		color: colors.textMuted,
		lineHeight: 17,
	},
	connectedRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	connectedBadge: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		flexShrink: 1,
	},
	connectedText: {
		fontSize: 13,
		fontFamily: fontFamily.bold,
		color: colors.text,
		flexShrink: 1,
	},
	disconnectButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: radius.sm,
		borderWidth: 1,
		borderColor: colors.dangerSoft,
	},
	disconnectText: {
		fontSize: 12,
		fontFamily: fontFamily.bold,
		color: colors.danger,
	},
	connectButtonText: {
		color: colors.onAccent,
		fontFamily: fontFamily.bold,
		fontSize: 14,
	},
	upgradeButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 6,
		paddingVertical: 10,
		borderRadius: radius.sm,
		borderWidth: 1.2,
		borderColor: colors.accent,
	},
	upgradeButtonText: {
		fontSize: 13,
		fontFamily: fontFamily.bold,
		color: colors.accent,
	},
	option: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 12,
		paddingHorizontal: 12,
		paddingVertical: 10,
		borderRadius: radius.sm,
		borderWidth: 1,
		borderColor: colors.border,
	},
	optionSpacing: {
		marginTop: 0,
	},
	optionSelected: {
		borderColor: colors.accent,
		backgroundColor: colors.accentSoft,
	},
	optionText: {
		flex: 1,
		gap: 2,
	},
	optionLabel: {
		fontSize: 14,
		fontFamily: fontFamily.bold,
		color: colors.text,
	},
	optionDescription: {
		fontSize: 11,
		fontFamily: fontFamily.medium,
		color: colors.textMuted,
	},
	instructionsInput: {
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radius.sm,
		padding: 10,
		minHeight: 64,
		fontSize: 13,
		fontFamily: fontFamily.medium,
		color: colors.text,
		textAlignVertical: "top",
	},
	helpSection: {
		gap: 3,
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
	linkRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	linkText: {
		fontSize: 13,
		fontFamily: fontFamily.bold,
		color: colors.accent,
	},
	version: {
		textAlign: "center",
		marginTop: 20,
		fontSize: 11,
		fontFamily: fontFamily.medium,
		color: colors.textMuted,
	},
});
