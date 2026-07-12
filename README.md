# Grocy — voice-to-grocery-list, in Tamil

Speak a grocery list out loud in Tamil (naturally — pauses, corrections, changed
your mind about an item, mixed-in English words) and watch it turn into a
structured, categorized, priced list in real time. Send the finished list to
someone else with a share link so they can tick items off while shopping.

Built for personal/family use, entirely on Cloudflare's stack — no separate
backend, no server to manage.

## How it works

- **Recording** happens in the browser with the [Web Speech
  API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
  (`ta-IN`) — the same engine behind Android voice typing, so accuracy for
  Tamil is genuinely good, and it's free.
- Each recognized segment is sent to a **[Cloudflare Agents
  SDK](https://developers.cloudflare.com/agents/)** Durable Object
  (`ListSessionAgent`), which re-runs extraction over the accumulated
  transcript and pushes the updated item list back to the browser over
  WebSocket — live, as you keep talking.
- Extraction, categorization, and price estimation are LLM calls via
  [OpenRouter](https://openrouter.ai) (defaults to Gemini). Categorization and
  pricing only run once, when you finalize the list, not on every live
  update — keeps the live experience fast and cheap.
- The finalized list is persisted in **D1** and served from a plain share
  route (`/list/:slug`) — no login, just an unguessable slug.

## Prerequisites

- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier is enough)
- Node.js 20+
- An [OpenRouter](https://openrouter.ai) API key

## Getting started

```bash
git clone https://github.com/lokesh-coder/grocy.git
cd grocy
npm install
npx wrangler login
```

Create your own D1 database (you can't reuse the one in this repo's
`wrangler.jsonc` — it's tied to the original deployment):

```bash
npx wrangler d1 create grocy-db
```

Copy the `database_id` from the output into `wrangler.jsonc`:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "grocy-db",
    "database_id": "<paste your database_id here>"
  }
]
```

Apply the schema locally:

```bash
npm run db:migrate:local
```

Set up your local secret — copy `.dev.vars.example` to `.dev.vars` and fill in
your real OpenRouter key:

```bash
cp .dev.vars.example .dev.vars
```

```
OPENROUTER_API_KEY=sk-or-v1-...
```

`.dev.vars` is git-ignored — it's never committed, and it's only for local
dev. Run it locally:

```bash
npm run dev
```

### Deploying

```bash
npm run db:migrate:remote   # apply the D1 schema to your real database
npx wrangler secret put OPENROUTER_API_KEY   # set the real secret on the Worker
npm run deploy
```

Your app will be live at `<worker-name>.<your-subdomain>.workers.dev`.

**This deploys with no authentication by default** — anyone who finds the URL
can use it (and trigger paid OpenRouter calls). For personal use, the easiest
fix is turning on [Cloudflare
Access](https://developers.cloudflare.com/cloudflare-one/access-controls/) for
your `workers.dev` subdomain (Workers & Pages → your Worker → **Domains** tab
→ set to **Protected**, then add the emails of everyone who should be allowed
in). It's a dashboard toggle, not a code change.

## Adapting this for your own language/household

A few places are meant to be edited:

- **`src/client/lib/liveTranscription.ts`** — `recognition.lang = "ta-IN"`.
  Change to whatever [BCP 47 language
  tag](https://en.wikipedia.org/wiki/IETF_language_tag) Web Speech API should
  listen for.
- **`src/shared/categories.ts`** — the fixed store taxonomy (vegetables,
  fruits, dairy, etc.). Edit this one array; the extraction prompt and the UI
  section grouping both derive from it automatically.
- **`src/server/lib/extract.ts`** — the extraction/categorization/pricing
  prompts. If you change the transcription language, the example phrases in
  these prompts (currently Tamil) should be updated to match, and the pricing
  prompt currently assumes Indian rupees/Tamil Nadu retail context.
- **`wrangler.jsonc`** `vars.EXTRACTION_MODEL` /
  `EXTRACTION_REASONING_EFFORT` — swap models or reasoning depth without
  touching code, since these route through OpenRouter.

## Known limitations

- Web Speech API's Tamil recognition doesn't work on iOS Safari — this app is
  built and tested for Chrome/Android.
- The waveform animation while recording is decorative, not reactive to actual
  mic volume — Web Speech API doesn't expose raw audio amplitude to the page.
- Price estimates are best-effort, sourced from a live web-search-grounded
  model call, not an authoritative price feed. Items the model isn't
  confident about are simply left unpriced.

## License

MIT — see [LICENSE](LICENSE).
