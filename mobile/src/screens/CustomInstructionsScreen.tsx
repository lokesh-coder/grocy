import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SettingsPageHeader } from "../components/SettingsPageHeader";
import { getCustomInstructions, setCustomInstructions } from "../lib/customInstructions";
import { colors, fontFamily, radius } from "../theme/tokens";

type Props = {
	onBack: () => void;
};

export function CustomInstructionsScreen({ onBack }: Props) {
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
			<SettingsPageHeader title="கூடுதல் வழிமுறைகள்" onBack={onBack} />
			<ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
	cardNote: {
		fontSize: 12,
		fontFamily: fontFamily.medium,
		color: colors.textMuted,
		lineHeight: 17,
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
});
