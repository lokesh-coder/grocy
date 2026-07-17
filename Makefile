.PHONY: help setup typecheck dev apk aab install provision-deploy site-deploy

help:
	@echo "Grocy — common commands"
	@echo ""
	@echo "  make setup             Install dependencies (mobile/ + provision/)"
	@echo "  make typecheck         Typecheck mobile/ + provision/"
	@echo "  make dev               Run a dev build on a connected Android device"
	@echo "  make apk               Build a signed release APK (sideload/testing)"
	@echo "  make aab               Build a signed release AAB (Play Store upload)"
	@echo "  make install           adb install the release APK just built"
	@echo "  make provision-deploy  Deploy provision/ (the OpenRouter key-minting Worker)"
	@echo "  make site-deploy       Deploy site/public (grocy.store)"

setup:
	cd mobile && npm install
	cd provision && npm install

typecheck:
	cd mobile && npx tsc --noEmit
	cd provision && npm run typecheck

dev:
	cd mobile && npx expo run:android

# Native project must be regenerated whenever app.json, assets/, or native
# config changes - always done here rather than left as a step to remember.
apk:
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
aab:
	cd mobile && npx expo prebuild --platform android --clean
	cd mobile/android && ./gradlew bundleRelease \
		-Pandroid.enableMinifyInReleaseBuilds=true \
		-Pandroid.enableShrinkResourcesInReleaseBuilds=true
	@echo ""
	@echo "AAB: mobile/android/app/build/outputs/bundle/release/app-release.aab"

install:
	adb install -r mobile/android/app/build/outputs/apk/release/app-release.apk

provision-deploy:
	cd provision && npm run deploy

site-deploy:
	npx wrangler pages deploy site/public --project-name grocy-site --branch=main
