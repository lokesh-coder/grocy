import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CircleCheck, Link2, Link2Off } from "lucide-react-native";
import { PressableScale } from "../components/PressableScale";
import { AccentButton } from "../components/AccentButton";
import { LoaderDots } from "../components/LoaderDots";
import { SettingsPageHeader } from "../components/SettingsPageHeader";
import { colors, fontFamily, radius } from "../theme/tokens";

type Props = {
	onBack: () => void;
	connected: boolean;
	isAuto: boolean;
	connecting: boolean;
	onConnect: () => void;
	onDisconnect: () => void;
};

// Not linked from SettingsMenu right now (hidden per the user's request -
// re-enabling later is just adding one row back to that menu) but still a
// real, working screen: RecordingScreen's OpenRouter-error alerts still
// route here directly via SettingsScreen's initialRoute, so a user who hits
// the free-tier limit still has a way out even while this is hidden from
// general navigation.
export function ConnectScreen({ onBack, connected, isAuto, connecting, onConnect, onDisconnect }: Props) {
	const insets = useSafeAreaInsets();

	return (
		<View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 10 }]}>
			<SettingsPageHeader title="திட்டம்" onBack={onBack} />
			<ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
				<View style={styles.card}>
					{connected && !isAuto && (
						<View style={styles.connectedRow}>
							<View style={styles.connectedBadge}>
								<CircleCheck size={16} color={colors.fun.sage} fill={colors.fun.sage} strokeWidth={2} />
								<Text style={styles.connectedText}>சொந்த கணக்கு இணைக்கப்பட்டது · வரம்பின்றி</Text>
							</View>
							<PressableScale onPress={onDisconnect} style={styles.disconnectButton}>
								<Link2Off size={14} color={colors.danger} strokeWidth={2.25} />
								<Text style={styles.disconnectText}>துண்டி</Text>
							</PressableScale>
						</View>
					)}
					{connected && isAuto && (
						<>
							<View style={styles.connectedRow}>
								<View style={styles.connectedBadge}>
									<CircleCheck size={16} color={colors.accent} fill={colors.accent} strokeWidth={2} />
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
										<Link2 size={14} color={colors.accent} strokeWidth={2.25} />
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
									<Link2 size={16} color={colors.onAccent} strokeWidth={2.25} />
									<Text style={styles.connectButtonText}>OpenRouter கணக்கை இணை</Text>
								</>
							)}
						</AccentButton>
					)}
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
});
