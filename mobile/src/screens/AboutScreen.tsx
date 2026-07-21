import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ExternalLink, Globe, ShieldCheck } from "lucide-react-native";
import { PressableScale } from "../components/PressableScale";
import { SettingsPageHeader } from "../components/SettingsPageHeader";
import { colors, fontFamily, radius } from "../theme/tokens";
import appJson from "../../app.json";

type Props = {
	onBack: () => void;
};

export function AboutScreen({ onBack }: Props) {
	const insets = useSafeAreaInsets();

	return (
		<View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 10 }]}>
			<SettingsPageHeader title="Grocy பற்றி" onBack={onBack} />
			<ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
				<View style={styles.card}>
					<Text style={styles.cardNote}>
						குரல் மூலம் தமிழில் மளிகை பட்டியல் உருவாக்க உதவும் ஆப். சொந்த சேவையகம் இல்லை, விளம்பரங்கள் இல்லை.
					</Text>
					<PressableScale style={styles.linkRow} onPress={() => Linking.openURL("https://grocy.store")}>
						<Globe size={15} color={colors.accent} strokeWidth={2.25} />
						<Text style={styles.linkText}>grocy.store</Text>
					</PressableScale>
					<PressableScale style={styles.linkRow} onPress={() => Linking.openURL("https://grocy.store/privacy")}>
						<ShieldCheck size={15} color={colors.accent} strokeWidth={2.25} />
						<Text style={styles.linkText}>தனியுரிமைக் கொள்கை</Text>
					</PressableScale>
					<PressableScale style={styles.linkRow} onPress={() => Linking.openURL("https://github.com/lokesh-coder/grocy")}>
						<ExternalLink size={15} color={colors.accent} strokeWidth={2.25} />
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
