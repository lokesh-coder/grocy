const { withAppBuildGradle } = require("expo/config-plugins");

// expo prebuild --clean wipes the whole android/ folder and regenerates
// build.gradle from scratch every time, which is what makes the default
// generated release build type sign with the local debug.keystore (itself
// regenerated on every --clean, breaking update-in-place installs). This
// plugin re-applies a stable release signingConfig, pointing at a keystore
// kept outside android/ (see keystores/README.md), on every prebuild run -
// a one-off manual edit to build.gradle would just get wiped again next
// time, this runs as part of the generation itself instead.
const KEYSTORE_RELATIVE_PATH = "../../keystores/release.keystore";

function withReleaseSigning(config) {
	return withAppBuildGradle(config, (config) => {
		const storePassword = process.env.RELEASE_KEYSTORE_PASSWORD;
		const keyAlias = process.env.RELEASE_KEYSTORE_ALIAS;

		if (!storePassword || !keyAlias) {
			throw new Error(
				"Missing RELEASE_KEYSTORE_PASSWORD / RELEASE_KEYSTORE_ALIAS in mobile/.env - see keystores/README.md",
			);
		}

		let contents = config.modResults.contents;

		if (!contents.includes("signingConfigs.release")) {
			// Modern (PKCS12) keystores only support one password - used for
			// both storePassword and keyPassword here (see keystores/README.md).
			contents = contents.replace(
				/signingConfigs\s*\{/,
				`signingConfigs {
        release {
            storeFile file('${KEYSTORE_RELATIVE_PATH}')
            storePassword '${storePassword}'
            keyAlias '${keyAlias}'
            keyPassword '${storePassword}'
        }`,
			);

			// Only the buildTypes.release block's signingConfig reference should
			// change - buildTypes.debug must keep using signingConfigs.debug.
			// Anchored on Expo's own template comment (which only appears once,
			// right above buildTypes.release's signingConfig line) rather than
			// a bare "release {" match, which would also match the release
			// signingConfig block just added above and skip past it into the
			// wrong (debug) buildType.
			contents = contents.replace(
				/(\/\/ Caution! In production, you need to generate your own keystore file\.[\s\S]*?)signingConfig signingConfigs\.debug/,
				"$1signingConfig signingConfigs.release",
			);
		}

		config.modResults.contents = contents;
		return config;
	});
}

module.exports = withReleaseSigning;
