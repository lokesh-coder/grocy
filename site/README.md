# grocy.store

Static site: landing page, privacy policy (required for Play Store), and the
OAuth callback page used by `mobile/src/lib/openrouterAuth.ts` (OpenRouter's
PKCE flow only accepts https/localhost callback URLs, not a custom app
scheme directly - see the comment in that file for why this page exists and
how the redirect actually works).

No build step - plain static HTML/CSS, deployed as-is.

## Redeploy

The `grocy.store` domain and the `grocy-site` Pages project live in a
*separate* Cloudflare account from the one used for everything else in this
project's history (the account that owns the domain, not the one Workers
used to be deployed to) - deploys need a token scoped to that account:

```bash
export CLOUDFLARE_API_TOKEN=<token scoped to the grocy.store account>
npx wrangler pages deploy site/public --project-name grocy-site --branch=main
```

`--branch=main` matters - without it, wrangler infers the branch from
whatever git branch this repo happens to be on and deploys a preview alias
instead of production, which the custom domain won't serve.

Live at `https://grocy.store` (custom domain attached to the
`grocy-site` Pages project - the underlying `*.pages.dev` project name may
differ from `grocy-site` if that exact name was already taken globally
across Cloudflare's shared `.pages.dev` namespace; check the Pages dashboard
if in doubt). If the domain ever changes, update `OAUTH_CALLBACK_URL` in
`mobile/src/lib/openrouterAuth.ts` to match.
