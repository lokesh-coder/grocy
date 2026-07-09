// Secrets (set via `wrangler secret put` / .dev.vars) aren't declared in
// wrangler.jsonc, so `wrangler types` has nothing to introspect for them.
// This augments the generated global Env interface by hand.
export {};

declare global {
	interface Env {
		SARVAM_API_KEY: string;
	}
}
