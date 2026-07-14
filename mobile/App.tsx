import { NavigationContainer, type LinkingOptions } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { RecordingScreen } from "./src/screens/RecordingScreen";
import { SharedListScreen } from "./src/screens/SharedListScreen";

export type RootStackParamList = {
  Recording: undefined;
  SharedList: { slug: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Lets `grocy://list/:slug` (and, once Android App Links are set up per the
// migration plan, the same https://grocy.notesane.workers.dev/list/:slug
// link already used for WhatsApp shares) open straight to that list.
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ["grocy://"],
  config: {
    screens: {
      Recording: "",
      SharedList: "list/:slug",
    },
  },
};

export default function App() {
  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Recording" component={RecordingScreen} />
        <Stack.Screen
          name="SharedList"
          component={({ route }: { route: { params: { slug: string } } }) => <SharedListScreen slug={route.params.slug} />}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
