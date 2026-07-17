.PHONY: help setup typecheck run run-release build build-store deploy-provision deploy-site

PACKAGE := store.grocy.app

help:
	@echo "Grocy — common commands"
	@echo ""
	@echo "  make run              Dev build - install + launch on a connected device"
	@echo "  make run-release      Build a release APK, install + launch it"
	@echo "  make build            Build a release APK only (no install)"
	@echo "  make build-store      Build a release AAB (for Play Store upload)"
	@echo "  make deploy-provision Deploy provision/ (the OpenRouter key-minting Worker)"
	@echo "  make deploy-site      Deploy site/public (grocy.store)"
	@echo "  make typecheck        Typecheck mobile/ + provision/"
	@echo "  make setup            Install dependencies (mobile/ + provision/)"

setup:
	cd mobile && npm install
	cd provision && npm install

typecheck:
	cd mobile && npx tsc --noEmit
	cd provision && npm run typecheck

# expo run:android builds a dev client, installs it, and launches it on a
# connected device in one step - needs the Metro dev server running too.
run:
	cd mobile && npx expo run:android

# Always rebuilds fresh rather than reusing whatever's already in
# build/outputs - a stale JS bundle or native config is a worse failure
# mode than a slower command.
run-release: build
	adb install -r mobile/android/app/build/outputs/apk/release/app-release.apk
	adb shell monkey -p $(PACKAGE) -c android.intent.category.LAUNCHER 1 > /dev/null

# Native project must be regenerated whenever app.json, assets/, or native
# config changes - always done here rather than left as a step to remember.
build:
	cd mobile && npx expo prebuild --platform android --clean
	cd mobile/android && ./gradlew assembleRelease \
		-PreactNativeArchitectures=arm64-v8a \
		-Pandroid.enableMinifyInReleaseBuilds=true \
		-Pandroid.enableShrinkResourcesInReleaseBuilds=true
	@echo ""
	@echo "APK: mobile/android/app/build/outputs/apk/release/app-release.apk"

# No reactNativeArchitectures restriction here on purpose - an App Bundle is
# supposed to carry every architecture, Play's dynamic delivery slices the
# right one per device at install time.
build-store:
	cd mobile && npx expo prebuild --platform android --clean
	cd mobile/android && ./gradlew bundleRelease \
		-Pandroid.enableMinifyInReleaseBuilds=true \
		-Pandroid.enableShrinkResourcesInReleaseBuilds=true
	@echo ""
	@echo "AAB: mobile/android/app/build/outputs/bundle/release/app-release.aab"

deploy-provision:
	cd provision && npm run deploy

deploy-site:
	npx wrangler pages deploy site/public --project-name grocy-site --branch=main
