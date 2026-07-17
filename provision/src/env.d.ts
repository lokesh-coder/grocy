// Secrets aren't declared in wrangler.jsonc (set via `wrangler secret put`
// instead), so `wrangler types` has no way to infer this - declared here by
// hand instead.
interface Env {
	OPENROUTER_PROVISIONING_KEY: string;
}
