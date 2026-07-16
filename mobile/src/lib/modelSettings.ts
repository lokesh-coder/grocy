import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_MODEL_ID } from "./models";

const MODEL_KEY = "grocy-extraction-model";

export async function getSelectedModel(): Promise<string> {
	const stored = await AsyncStorage.getItem(MODEL_KEY);
	return stored ?? DEFAULT_MODEL_ID;
}

export async function setSelectedModel(id: string): Promise<void> {
	await AsyncStorage.setItem(MODEL_KEY, id);
}
