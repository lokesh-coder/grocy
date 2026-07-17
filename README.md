# Grocy — voice-to-grocery-list, in Tamil

Speak a grocery list out loud in Tamil (naturally — pauses, corrections, changed
your mind about an item, mixed-in English words) and watch it turn into a
clean, optionally categorized-and-priced list. Share the finished list as
text to WhatsApp or anywhere else.

Personal/family-use Android app, now also on the Play Store. Almost no
backend — one tiny endpoint, everything else happens on-device or directly
against OpenRouter.

Common commands are in the `Makefile` - run `make help` to see them
(building the APK/AAB, deploying `provision/` or `site/`, typecheck, etc.)
rather than remembering the underlying `expo`/`gradlew`/`wrangler` commands
by hand. The rest of this README explains what each of those commands
actually does, for whenever that's useful.

## Architecture

```
mobile/                     Android app (Expo / React Native)
  ├─ Recording screen          - mic button, live transcript, Done, Organize, share
  └─ Settings                  - connect an OpenRouter account, pick a model

provision/                  Cloudflare Worker (grocy-provision) - the one
                             backend endpoint Grocy has: mints a free,
                             capped OpenRouter key on first use, sees no
                             user data (see provision/src/index.ts)

site/                       Static site (grocy.store) - landing page, privacy
                             policy, and the OAuth callback page the app's
                             connect flow redirects through (see site/README.md)

OpenRouter (Gemini)         Extraction, categorization, price estimation
```

The app talks directly to OpenRouter for everything - extraction,
categorization, pricing - using an API key stored on-device
(`expo-secure-store`). Where that key comes from is layered:

1. **First use, automatically**: the app calls `provision/`'s one endpoint,
   which mints a small, spending-capped OpenRouter key (auto-renews
   monthly) and hands it back. No signup, no connecting anything - this is
   what makes the app usable immediately for someone who's never heard of
   OpenRouter.
2. **Optional upgrade, from Settings**: connecting a real OpenRouter account
   via [PKCE OAuth](https://openrouter.ai/docs/use-cases/oauth-pkce)
   (`mobile/src/lib/openrouterAuth.ts`) replaces the auto-provisioned key
   with an unlimited one the user controls and pays for themselves - no
   client secret needed for this exchange, so it's still not something
   `provision/` is involved in.

`provision/` never sees grocery list content, voice data, or anything
personal - its only job is "mint a key," gated by one secret (an OpenRouter
Management/Provisioning key) it holds server-side. This is a deliberately
tiny reintroduction of backend after an earlier fully-backend-less version
of this app turned out to be too much friction for a normal user (no
account, no OpenRouter knowledge, should just work) - see git history for
that fully backend-less iteration if useful as reference, along with the
earlier Cloudflare Worker + Durable Object + D1 version before that (also
removed, for being more than the app actually needed).

Everything the app needs across sessions (last list, frequent-item quick-add
suggestions) lives on-device (`mobile/src/lib/listHistory.ts`, AsyncStorage).
There's no shared/live list between two phones and no web client (there used
to be a PWA; retired in favor of the native app, which does everything
better on Android: real voice recognition quality, no browser chrome, home
screen widgets/shortcuts potential, etc.)

## Deploying provision/

```bash
cd provision
npm install
npx wrangler secret put OPENROUTER_PROVISIONING_KEY   # an OpenRouter Management/Provisioning key, from your OpenRouter account settings - not a regular API key
npm run deploy
```

`FREE_LIMIT_USD` in `provision/src/index.ts` controls how much credit each
auto-provisioned key gets (currently a small amount, auto-renewing
monthly) - tune it there if usage patterns after launch suggest it should
be higher or lower.

## Setup

### Prerequisites

- [Android Studio](https://developer.android.com/studio) / Android SDK, or at
  minimum the command-line tools + platform-tools + a build-tools version +
  an NDK
- A physical Android device (or emulator) for testing
- Nothing OpenRouter-related to set up yourself - a fresh install
  auto-provisions a free key against the deployed `provision/` Worker on
  first use (see the Architecture section above). An
  [OpenRouter](https://openrouter.ai) account is only needed if you want to
  connect your own from Settings instead.

### Development build

```bash
cd mobile
npm install
npx expo run:android   # builds + installs to a connected device via USB
```

This is a debug build wired to the Metro bundler (needs the dev server
running) — for day-to-day testing, not for sharing to another phone. Record
a list and tap "Done" - a free key provisions itself automatically the
first time it's needed, no setup required.

## Building a release APK (for real use, not dev)

A release build is fully standalone (JS bundle baked in, no dev server
needed) and is what you'd actually install day-to-day or share to another
phone.

### One-time: release signing key

Release builds need a stable signing identity so future rebuilds can install
as *updates* rather than requiring an uninstall every time. This repo's
`mobile/android/` folder gets wiped and regenerated on every
`expo prebuild --clean`, so the signing key can't live inside it — it's kept
at `mobile/keystores/release.keystore` instead (gitignored — **back this file
up somewhere safe**; if it's lost, no future build can update over an
existing install on any device), wired in automatically on every prebuild via
`mobile/plugins/withReleaseSigning.js` (an Expo config plugin).

If you're setting this up fresh (no existing `keystores/release.keystore`):

```bash
cd mobile
mkdir -p keystores
keytool -genkeypair -v \
  -keystore keystores/release.keystore \
  -alias grocy-release \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass "<choose a strong password>" \
  -dname "CN=Grocy, OU=Personal, O=Personal, L=Unknown, ST=Unknown, C=IN"
```

Then add to `mobile/.env` (not `.env.example` — this one's real and gitignored):

```
RELEASE_KEYSTORE_PASSWORD=<the password you chose above>
RELEASE_KEYSTORE_ALIAS=grocy-release
```

(Modern keystores only support one password for both store and key — see
`mobile/keystores/README.md`.)

### Build

```bash
cd mobile
npx expo prebuild --platform android --clean   # regenerate native project
cd android
./gradlew assembleRelease \
  -PreactNativeArchitectures=arm64-v8a \
  -Pandroid.enableMinifyInReleaseBuilds=true \
  -Pandroid.enableShrinkResourcesInReleaseBuilds=true
```

Output: `mobile/android/app/build/outputs/apk/release/app-release.apk`. The
`arm64-v8a`-only flag matters — without it, the default build bundles native
libraries for 4 CPU architectures including two (`x86`/`x86_64`) that only
emulators use, roughly tripling the APK size for no benefit on a real phone.

### Install / share

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

Or send the `.apk` file to another phone any way you like (Drive, email,
WhatsApp, USB) — the recipient opens it, allows "install unknown apps" for
whatever app they used to open it, and taps install. Play Protect may warn
it's not from the Play Store — expected for a sideloaded app.

## Building an AAB (for Play Store submission)

Play Console requires an `.aab` (Android App Bundle), not an `.apk`. Same
signing setup as above, but **don't** restrict `reactNativeArchitectures`
here - unlike a sideloaded APK, an App Bundle is supposed to contain every
architecture; Play's own dynamic delivery slices out the right one per
device at install time, so restricting it at build time would just break
installs on devices Play didn't get to optimize for.

```bash
cd mobile
npx expo prebuild --platform android --clean
cd android
./gradlew bundleRelease \
  -Pandroid.enableMinifyInReleaseBuilds=true \
  -Pandroid.enableShrinkResourcesInReleaseBuilds=true
```

Output: `mobile/android/app/build/outputs/bundle/release/app-release.aab`
(~57MB - larger than the arm64-only APK since it carries all 4
architectures, but Play only ever ships one per device). Upload this
directly in Play Console; the first upload prompts you to opt into Play App
Signing (accept it - Google re-signs the app for distribution using this
upload as the "upload key").

## Adapting this for your own language/household

- **`mobile/src/screens/RecordingScreen.tsx`** — `lang: "ta-IN"` passed to
  `expo-speech-recognition`. Change to whatever [BCP 47 language
  tag](https://en.wikipedia.org/wiki/IETF_language_tag) it should listen for.
- **`mobile/src/shared/categories.ts`** — the fixed store taxonomy
  (vegetables, fruits, dairy, etc.). Edit this one array; the extraction
  prompt and the app's section grouping both derive from it automatically.
- **`mobile/src/lib/extract.ts`** — the extraction/categorization/pricing
  prompts. If you change the transcription language, the example phrases in
  these prompts (currently Tamil) should be updated to match, and the pricing
  prompt currently assumes Indian rupees/Tamil Nadu retail context.
- **`mobile/src/lib/models.ts`** — the curated model picker list shown in
  Settings. Any OpenRouter model id can go here.

## Known limitations

- Android only — no iOS build has been attempted; several native modules
  (speech recognition, the release signing setup) are Android-specific as
  written.
- Price estimates are best-effort, sourced from a live web-search-grounded
  model call, not an authoritative price feed. Items the model isn't
  confident about are simply left unpriced.
- No automated test suite — verification throughout this project has been
  manual, on-device testing (matches the scale of a personal app).
- List history (last list, frequent-item suggestions) is local to each
  device, not shared between phones — uninstalling the app or clearing its
  storage loses it.
- Every device needs its own one-time OpenRouter connect step (Settings →
  Connect). The same OpenRouter account can be authorized on multiple
  devices if you want shared billing.

## License

MIT — see [LICENSE](LICENSE).
