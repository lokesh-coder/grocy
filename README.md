# Grocy — voice-to-grocery-list, in Tamil

Speak a grocery list out loud in Tamil (naturally — pauses, corrections, changed
your mind about an item, mixed-in English words) and watch it turn into a
clean, optionally categorized-and-priced list. Share the finished list as
text to WhatsApp or anywhere else.

Personal/family-use Android app, built on Cloudflare's stack for the backend —
no separate server to manage, and no data stored server-side at all.

## Architecture

```
mobile/                     Android app (Expo / React Native)
  └─ Recording screen          - mic button, live transcript, Done, Organize, share

src/server/                 Cloudflare Worker (Hono) - "grocy"
  ├─ POST /api/extract          Transcript -> extracted items (runs once, at "Done")
  └─ POST /api/organize         Items -> categorized + priced items (on demand)

OpenRouter (Gemini)         Extraction, categorization, price estimation
```

The Worker exists only to keep the OpenRouter API key off the device - it's
fully stateless, no database, nothing persisted server-side. Everything the
app needs across sessions (last list, frequent-item quick-add suggestions)
lives on-device (`mobile/src/lib/listHistory.ts`, backed by AsyncStorage).
There's no shared/live list between two phones and no web client anymore
(there used to be a PWA; it's been retired in favor of the native app, which
does everything better on Android: real voice recognition quality, no browser
chrome, home screen widgets/shortcuts potential, etc.) The app already holds
the transcript locally while recording (that's what renders the live segment
list on screen), so it just POSTs the whole thing once on "Done" - no need
for a stateful server-side session for what's a single request/response.

## Backend setup (Cloudflare Worker)

### Prerequisites

- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier is enough)
- Node.js 20+
- An [OpenRouter](https://openrouter.ai) API key

### Setup

```bash
git clone https://github.com/lokesh-coder/grocy.git
cd grocy
npm install
npx wrangler login
```

Set up your local secret:

```bash
cp .dev.vars.example .dev.vars
# edit .dev.vars: OPENROUTER_API_KEY=sk-or-v1-...
```

`.dev.vars` is git-ignored — never committed, local dev only.

```bash
npm run dev   # wrangler dev
```

### Deploying

```bash
npx wrangler secret put OPENROUTER_API_KEY   # set the real secret on the Worker
npm run deploy                               # wrangler deploy
```

Live at `<worker-name>.<your-subdomain>.workers.dev`.

**This deploys with no authentication by default** — anyone who finds the URL
can use it (and trigger paid OpenRouter calls). For personal use, turn on
[Cloudflare
Access](https://developers.cloudflare.com/cloudflare-one/access-controls/) on
your `workers.dev` subdomain (Workers & Pages → your Worker → **Domains** tab
→ **Protected**, add the emails allowed in) — a dashboard toggle, not a code
change. The Android app authenticates around this separately (see below).

## Android app setup

The app lives in `mobile/` as its own Expo project.

### Prerequisites

- Everything above (the Worker needs to be deployed and reachable first)
- [Android Studio](https://developer.android.com/studio) / Android SDK, or at
  minimum the command-line tools + platform-tools + a build-tools version +
  an NDK
- A physical Android device (or emulator) for testing

### Auth: connecting the app to an Access-protected Worker

A browser can complete Cloudflare Access's interactive login; a native app
can't. The app instead authenticates as a Cloudflare Access **Service
Token**:

1. Zero Trust dashboard → **Access** → **Service Auth** → **Service Tokens** →
   create one. Note the Client ID/Secret (secret shown once).
2. **Access controls** → **Applications** → open the application that already
   protects your Worker's domain → **Policies** → **Create new policy** →
   Action: `Service Auth`, Include rule: Service Token → select the token you
   just made → save. (Not a new application — just a second policy on the
   existing one. The browser-login policy for humans stays untouched.)
3. `cd mobile && cp .env.example .env`, fill in:
   ```
   EXPO_PUBLIC_CF_ACCESS_CLIENT_ID=...
   EXPO_PUBLIC_CF_ACCESS_CLIENT_SECRET=...
   ```

### Development build

```bash
cd mobile
npm install
npx expo run:android   # builds + installs to a connected device via USB
```

This is a debug build wired to the Metro bundler (needs the dev server
running) — for day-to-day testing, not for sharing to another phone.

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

Output: `mobile/android/app/build/outputs/apk/release/app-release.apk`
(~38MB). The `arm64-v8a`-only flag matters — without it, the default build
bundles native libraries for 4 CPU architectures including two
(`x86`/`x86_64`) that only emulators use, roughly tripling the APK size for
no benefit on a real phone.

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
- **`src/shared/categories.ts`** — the fixed store taxonomy (vegetables,
  fruits, dairy, etc.). Edit this one array; the extraction prompt and the
  app's section grouping both derive from it automatically. `mobile/src/shared/categories.ts`
  is a manually-kept-in-sync copy (see the comment at the top of that file) —
  update both.
- **`src/server/lib/extract.ts`** — the extraction/categorization/pricing
  prompts. If you change the transcription language, the example phrases in
  these prompts (currently Tamil) should be updated to match, and the pricing
  prompt currently assumes Indian rupees/Tamil Nadu retail context.
- **`wrangler.jsonc`** `vars.EXTRACTION_MODEL` /
  `EXTRACTION_REASONING_EFFORT` — swap models or reasoning depth without
  touching code, since these route through OpenRouter.

## Known limitations

- Android only — no iOS build has been attempted; several native modules
  (speech recognition, the release signing setup) are Android-specific as
  written.
- Price estimates are best-effort, sourced from a live web-search-grounded
  model call, not an authoritative price feed. Items the model isn't
  confident about are simply left unpriced.
- No automated test suite — verification throughout this project has been
  manual, on-device testing (matches the scale of a 2-user personal app).
- List history (last list, frequent-item suggestions) is local to each
  device, not shared between phones — uninstalling the app or clearing its
  storage loses it.

## License

MIT — see [LICENSE](LICENSE).
