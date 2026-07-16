import { useCallback, useEffect } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { RecordingScreen } from "./src/screens/RecordingScreen";
import { useAppFonts } from "./src/theme/useAppFonts";
import { colors } from "./src/theme/tokens";

SplashScreen.preventAutoHideAsync();

export default function App() {
  const fontsLoaded = useAppFonts();

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) await SplashScreen.hideAsync();
  }, [fontsLoaded]);

  useEffect(() => {
    onLayoutRootView();
  }, [onLayoutRootView]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <RecordingScreen />
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
