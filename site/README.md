# grocy.store

Static site: landing page, privacy policy (required for Play Store), and the
OAuth callback page used by `mobile/src/lib/openrouterAuth.ts` (OpenRouter's
PKCE flow only accepts https/localhost callback URLs, not a custom app
scheme directly - see the comment in that file for why this page exists and
how the redirect actually works).

No build step - plain static HTML/CSS, deployed as-is.

## Redeploy

```bash
npx wrangler pages deploy site --project-name grocy-site
```

Live at `https://grocy-site.pages.dev` until a custom domain (`grocy.store`)
is attached in the Cloudflare dashboard once its DNS is managed by
Cloudflare - if the URL changes, update `OAUTH_CALLBACK_URL` in
`mobile/src/lib/openrouterAuth.ts` to match.
