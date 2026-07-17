import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { CheckCircleIcon, LinkBreakIcon, LinkSimpleIcon, XIcon } from "phosphor-react-native";
import { MODEL_OPTIONS } from "../lib/models";
import { PressableScale } from "./PressableScale";
import { AccentButton } from "./AccentButton";
import { LoaderDots } from "./LoaderDots";
import { colors, fontFamily, radius } from "../theme/tokens";

type Props = {
	visible: boolean;
	selectedModel: string;
	onSelect: (id: string) => void;
	onClose: () => void;
	connected: boolean;
	isAuto: boolean;
	connecting: boolean;
	onConnect: () => void;
	onDisconnect: () => void;
};

// A settings screen would normally be a separate route, but the app is
// intentionally a single screen (see App.tsx) - a modal keeps this from
// dragging navigation back in just for two small setup/experiment controls.
export function SettingsModal({
	visible,
	selectedModel,
	onSelect,
	onClose,
	connected,
	isAuto,
	connecting,
	onConnect,
	onDisconnect,
}: Props) {
	return (
		<Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
			<Pressable style={styles.backdrop} onPress={onClose}>
				<Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
					<View style={styles.header}>
						<Text style={styles.title}>அமைப்புகள்</Text>
						<PressableScale onPress={onClose} style={styles.closeButton}>
							<XIcon weight="bold" size={16} color={colors.textMuted} />
						</PressableScale>
					</View>

					<Text style={styles.sectionLabel}>OpenRouter கணக்கு</Text>
					{connected && !isAuto && (
						<View style={styles.connectedRow}>
							<View style={styles.connectedBadge}>
								<CheckCircleIcon weight="fill" size={16} color={colors.fun.sage} />
								<Text style={styles.connectedText}>இணைக்கப்பட்டது</Text>
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
							<Text style={styles.autoNote}>
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

					<Text style={[styles.sectionLabel, styles.modelSectionLabel]}>மாடல்</Text>
					{MODEL_OPTIONS.map((option) => {
						const selected = option.id === selectedModel;
						return (
							<PressableScale
								key={option.id}
								style={[styles.option, selected && styles.optionSelected]}
								onPress={() => onSelect(option.id)}
							>
								<View style={styles.optionText}>
									<Text style={styles.optionLabel}>{option.label}</Text>
									<Text style={styles.optionDescription}>{option.description}</Text>
								</View>
								{selected && <CheckCircleIcon weight="fill" size={20} color={colors.accent} />}
							</PressableScale>
						);
					})}
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
		backgroundColor: colors.surface,
		borderRadius: radius.md,
		padding: 16,
		gap: 8,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: 4,
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
	sectionLabel: {
		fontSize: 11,
		fontFamily: fontFamily.extrabold,
		letterSpacing: 0.5,
		textTransform: "uppercase",
		color: colors.textMuted,
		marginBottom: 2,
	},
	modelSectionLabel: {
		marginTop: 10,
	},
	connectedRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingVertical: 4,
	},
	connectedBadge: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
	},
	connectedText: {
		fontSize: 13,
		fontFamily: fontFamily.bold,
		color: colors.text,
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
	autoNote: {
		fontSize: 11,
		fontFamily: fontFamily.medium,
		color: colors.textMuted,
		lineHeight: 15,
		marginTop: 2,
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
		marginTop: 6,
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
});
