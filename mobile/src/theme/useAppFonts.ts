import {
	useFonts,
	MuktaMalar_400Regular,
	MuktaMalar_500Medium,
	MuktaMalar_600SemiBold,
	MuktaMalar_700Bold,
	MuktaMalar_800ExtraBold,
} from "@expo-google-fonts/mukta-malar";

// Only the weights actually used (matches the web app's usage) - the family
// also exports 200/300 which aren't needed here.
export function useAppFonts(): boolean {
	const [loaded] = useFonts({
		MuktaMalar_400Regular,
		MuktaMalar_500Medium,
		MuktaMalar_600SemiBold,
		MuktaMalar_700Bold,
		MuktaMalar_800ExtraBold,
	});
	return loaded;
}
