module.exports = function (api) {
	api.cache(true);
	return {
		presets: ["babel-preset-expo"],
		// Must be last - converts worklets (reanimated's animation functions)
		// to run on the UI thread. Not auto-included by babel-preset-expo for
		// projects scaffolded before Expo SDK 50's default template started
		// bundling it.
		plugins: ["react-native-worklets/plugin"],
	};
};
