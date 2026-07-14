import AsyncStorage from "@react-native-async-storage/async-storage";

// AsyncStorage (not a sync API, unlike the web's localStorage) so an
// in-progress list survives the app being closed mid-dictation. Cleared as
// soon as a list is finalized, same as the web client's session id.
const SESSION_STORAGE_KEY = "grocy-session-id";

export async function getOrCreateSessionId(): Promise<string> {
	const existing = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
	if (existing) return existing;
	const created = crypto.randomUUID();
	await AsyncStorage.setItem(SESSION_STORAGE_KEY, created);
	return created;
}

export async function clearSessionId(): Promise<void> {
	await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
}
