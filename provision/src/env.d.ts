// Secrets aren't declared in wrangler.jsonc (set via `wrangler secret put`
// instead), so `wrangler types` has no way to infer this - declared here by
// hand instead. PROVISIONED_KEYS itself is generated into
// worker-configuration.d.ts from the kv_namespaces binding in
// wrangler.jsonc (see `npm run cf-typegen`), so it isn't redeclared here.
interface Env {
	OPENROUTER_PROVISIONING_KEY: string;
}
