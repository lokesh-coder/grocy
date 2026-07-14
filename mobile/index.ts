// Must be the very first import - agents/partysocket call crypto.randomUUID()
// with no fallback, and Hermes has no Web Crypto without this polyfill.
import 'react-native-get-random-values';

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
