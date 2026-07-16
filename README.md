# Grocy — voice-to-grocery-list, in Tamil

Speak a grocery list out loud in Tamil (naturally — pauses, corrections, changed
your mind about an item, mixed-in English words) and watch it turn into a
clean, optionally categorized-and-priced list. Share the finished list as
text to WhatsApp or anywhere else.

Personal/family-use Android app. No backend at all — just the app.

## Architecture

```
mobile/                     Android app (Expo / React Native)
  ├─ Recording screen          - mic button, live transcript, Done, Organize, share
  └─ Settings                  - connect an OpenRouter account, pick a model

site/                       Static site (grocy.store) - landing page, privacy
                             policy, and the OAuth callback page the app's
                             connect flow redirects through (see site/README.md)

OpenRouter (Gemini)         Extraction, categorization, price estimation
```

There's no app server. The app connects directly to OpenRouter using a
[PKCE OAuth flow](https://openrouter.ai/docs/use-cases/oauth-pkce)
(`mobile/src/lib/openrouterAuth.ts`) — the user authorizes once from
Settings, the resulting API key is theirs, stored on-device (`expo-secure-
store`), and every extraction/categorization/pricing call goes straight from
the phone to OpenRouter with that key. Usage draws from whatever OpenRouter
account authorized it, so there's nothing to host, meter, or pay for
centrally — one person can authorize once and share that same connected
device setup with family, or each person can connect their own account.

This used to run through a Cloudflare Worker whose only job was keeping a
shared API key off the device. Once PKCE removed the need for a shared key
at all (no client secret required for the exchange), the Worker had nothing
left to do. Before that, it also briefly held a Durable Object and D1 for a
shared/live tick-off-while-shopping feature that turned out not to be
needed either — see git history if any of that is useful as reference.

Everything the app needs across sessions (last list, frequent-item quick-add
suggestions) lives on-device (`mobile/src/lib/listHistory.ts`, AsyncStorage).
There's no shared/live list between two phones and no web client (there used
to be a PWA; retired in favor of the native app, which does everything
better on Android: real voice recognition quality, no browser chrome, home
screen widgets/shortcuts potential, etc.)

## Setup

### Prerequisites

- [Android Studio](https://developer.android.com/studio) / Android SDK, or at
  minimum the command-line tools + platform-tools + a build-tools version +
  an NDK
- A physical Android device (or emulator) for testing
- An [OpenRouter](https://openrouter.ai) account (created during the in-app
  connect flow if you don't have one yet — no separate setup needed)

### Development build

```bash
cd mobile
npm install
npx expo run:android   # builds + installs to a connected device via USB
```

This is a debug build wired to the Metro bundler (needs the dev server
running) — for day-to-day testing, not for sharing to another phone.

On first launch, open the gear icon → **OpenRouter கணக்கை இணை** (Connect
OpenRouter account) to complete the OAuth flow before recording a list —
extraction/organize calls fail with a clear error until this is done.

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
