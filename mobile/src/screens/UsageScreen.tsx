import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SettingsPageHeader } from "../components/SettingsPageHeader";
import { LoaderDots } from "../components/LoaderDots";
import { getKeyUsage, type KeyUsage } from "../lib/openrouterAuth";
import { colors, fontFamily, radius } from "../theme/tokens";

type Props = {
	onBack: () => void;
};

function formatUsd(value: number): string {
	return `$${value.toFixed(2)}`;
}

// undefined = still loading, null = no key connected yet (never triggers
// auto-provisioning itself - see getKeyUsage).
export function UsageScreen({ onBack }: Props) {
	const insets = useSafeAreaInsets();
	const [usage, setUsage] = useState<KeyUsage | null | undefined>(undefined);

	useEffect(() => {
		getKeyUsage().then(setUsage);
	}, []);

	return (
		<View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 10 }]}>
			<SettingsPageHeader title="பயன்பாடு" onBack={onBack} />
			<View style={styles.content}>
				{usage === undefined ? (
					<View style={styles.loadingRow}>
						<LoaderDots variant="fun" />
					</View>
				) : usage === null ? (
					<View style={styles.card}>
						<Text style={styles.cardNote}>இணைக்கப்படவில்லை - பட்டியல் ஒன்றை உருவாக்கியதும் பயன்பாட்டு விவரங்கள் இங்கே தெரியும்.</Text>
					</View>
				) : (
					<View style={styles.card}>
						<Text style={styles.usageAmount}>{formatUsd(usage.usage)}</Text>
						<Text style={styles.usageLabel}>இதுவரை செலவழிக்கப்பட்டது</Text>

						{usage.limit != null ? (
							<>
								<View style={styles.barTrack}>
									<View style={[styles.barFill, { width: `${Math.min(100, (usage.usage / usage.limit) * 100)}%` }]} />
								</View>
								<Text style={styles.cardNote}>
									வரம்பு: {formatUsd(usage.limit)}
									{usage.limitRemaining != null && ` · மீதம்: ${formatUsd(usage.limitRemaining)}`}
									{usage.limitReset && ` · ${usage.limitReset === "monthly" ? "மாதாந்திரம் புதுப்பிக்கும்" : usage.limitReset}`}
								</Text>
							</>
						) : (
							<Text style={styles.cardNote}>வரம்பின்றி - சொந்த OpenRouter கணக்கு இணைக்கப்பட்டுள்ளது.</Text>
						)}
					</View>
				)}

				<Text style={styles.disclaimer}>
					இந்த தொகைகள் OpenRouter-இன் நேரடி USD கணக்கு - மளிகை பொருட்களுக்கான ₹ மதிப்பீடுகளில் இருந்து வேறுபட்டது.
				</Text>
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
		gap: 12,
	},
	loadingRow: {
		alignItems: "center",
		paddingVertical: 24,
	},
	card: {
		backgroundColor: colors.surface,
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radius.md,
		padding: 16,
		gap: 8,
	},
	usageAmount: {
		fontSize: 28,
		fontFamily: fontFamily.extrabold,
		color: colors.text,
	},
	usageLabel: {
		fontSize: 12,
		fontFamily: fontFamily.semibold,
		color: colors.textMuted,
		marginTop: -4,
	},
	barTrack: {
		height: 8,
		borderRadius: radius.pill,
		backgroundColor: colors.surfaceAlt,
		overflow: "hidden",
		marginTop: 6,
	},
	barFill: {
		height: "100%",
		borderRadius: radius.pill,
		backgroundColor: colors.accent,
	},
	cardNote: {
		fontSize: 12,
		fontFamily: fontFamily.medium,
		color: colors.textMuted,
		lineHeight: 17,
	},
	disclaimer: {
		fontSize: 11,
		fontFamily: fontFamily.medium,
		color: colors.textMuted,
		lineHeight: 16,
		paddingHorizontal: 4,
	},
});
