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

// Lets `grocy://list/:slug` open straight to that list. Shared (WhatsApp/
// etc.) links are a separate https://grocy-open.notesane.workers.dev/list/:slug
// URL (see link/ at the repo root) that redirects into this scheme via
// Android's intent:// mechanism - not handled by this app directly, so it
// isn't listed as a prefix here.
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ["grocy://"],
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
