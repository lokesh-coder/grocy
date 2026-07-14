// Must be the very first imports - agents/partysocket call crypto.randomUUID()
// with no fallback, and construct a `MessageEvent` global that Hermes
// doesn't provide. See polyfills.ts for the MessageEvent details.
import 'react-native-get-random-values';
import './src/lib/polyfills';

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
