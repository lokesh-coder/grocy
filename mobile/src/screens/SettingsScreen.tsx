import { useEffect, useState } from "react";
import { BackHandler } from "react-native";
import { AboutScreen } from "./AboutScreen";
import { ConnectScreen } from "./ConnectScreen";
import { CustomInstructionsScreen } from "./CustomInstructionsScreen";
import { FeedbackScreen } from "./FeedbackScreen";
import { HelpScreen } from "./HelpScreen";
import { SettingsMenu } from "./SettingsMenu";
import { UsageScreen } from "./UsageScreen";

export type SettingsRoute = "menu" | "connect" | "instructions" | "usage" | "help" | "feedback" | "about";

type Props = {
	onClose: () => void;
	// Defaults to the menu - RecordingScreen's OpenRouter-error alerts pass
	// "connect" instead, so a user hitting the free-tier limit lands
	// directly on the (menu-hidden) Connect page rather than a dead end.
	initialRoute?: SettingsRoute;
	connected: boolean;
	isAuto: boolean;
	connecting: boolean;
	onConnect: () => void;
	onDisconnect: () => void;
};

// A thin router, not a real navigation stack - matches the app's existing
// "just a boolean/state toggle" pattern (see RecordingScreen's own
// settingsVisible) rather than pulling in react-navigation for one level of
// depth. Each subpage owns its own screen (container, insets, header).
export function SettingsScreen({ onClose, initialRoute = "menu", connected, isAuto, connecting, onConnect, onDisconnect }: Props) {
	const [route, setRoute] = useState<SettingsRoute>(initialRoute);

	// Only intercepts the hardware back button while on a subpage (pops to
	// the menu) - at the menu itself, this doesn't register, so
	// RecordingScreen's own listener (which closes Settings entirely) is the
	// one that fires, exactly as it did before Settings had any sub-pages.
	useEffect(() => {
		if (route === "menu") return;
		const sub = BackHandler.addEventListener("hardwareBackPress", () => {
			setRoute("menu");
			return true;
		});
		return () => sub.remove();
	}, [route]);

	const onBack = () => setRoute("menu");

	if (route === "connect") {
		return (
			<ConnectScreen onBack={onBack} connected={connected} isAuto={isAuto} connecting={connecting} onConnect={onConnect} onDisconnect={onDisconnect} />
		);
	}
	if (route === "instructions") return <CustomInstructionsScreen onBack={onBack} />;
	if (route === "usage") return <UsageScreen onBack={onBack} />;
	if (route === "help") return <HelpScreen onBack={onBack} />;
	if (route === "feedback") return <FeedbackScreen onBack={onBack} />;
	if (route === "about") return <AboutScreen onBack={onBack} />;

	return <SettingsMenu onClose={onClose} onNavigate={setRoute} />;
}
