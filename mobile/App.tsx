import { useCallback, useEffect } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { DefaultTheme, NavigationContainer, type LinkingOptions } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as SplashScreen from "expo-splash-screen";
import { RecordingScreen } from "./src/screens/RecordingScreen";
import { SharedListScreen } from "./src/screens/SharedListScreen";
import { useAppFonts } from "./src/theme/useAppFonts";
import { colors } from "./src/theme/tokens";

SplashScreen.preventAutoHideAsync();

export type RootStackParamList = {
  Recording: undefined;
  SharedList: { slug: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Lets `grocy://list/:slug` AND the same https://grocy.notesane.workers.dev
// /list/:slug link already used for WhatsApp shares open straight to that
// list - the https prefix only works because of the Android App Links
// verification set up via android.intentFilters below and the Worker's
// /.well-known/assetlinks.json route (src/server/index.ts).
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ["grocy://", "https://grocy.notesane.workers.dev"],
  config: {
    screens: {
      Recording: "",
      SharedList: "list/:slug",
    },
  },
};

// Matches the app background so the native screen-transition animation
// doesn't flash white between the two warm-cream screens.
const navigationTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.bg, card: colors.bg, border: colors.border, primary: colors.accent },
};

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
          <NavigationContainer theme={navigationTheme} linking={linking}>
            <Stack.Navigator
              screenOptions={{
                headerShown: false,
                animation: "slide_from_right",
                contentStyle: { backgroundColor: colors.bg },
              }}
            >
              <Stack.Screen name="Recording" component={RecordingScreen} />
              <Stack.Screen
                name="SharedList"
                component={({ route }: { route: { params: { slug: string } } }) => <SharedListScreen slug={route.params.slug} />}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
