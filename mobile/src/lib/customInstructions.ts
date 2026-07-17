import AsyncStorage from "@react-native-async-storage/async-storage";

// Free-text, appended to the extraction prompt (see extract.ts) - lets
// someone correct a recurring misunderstanding themselves (a mispronounced
// brand name, a personal unit preference) without needing a code change.
const KEY = "grocy-custom-instructions";

export async function getCustomInstructions(): Promise<string> {
	return (await AsyncStorage.getItem(KEY)) ?? "";
}

export async function setCustomInstructions(value: string): Promise<void> {
	const trimmed = value.trim();
	if (trimmed) {
		await AsyncStorage.setItem(KEY, trimmed);
	} else {
		await AsyncStorage.removeItem(KEY);
	}
}
