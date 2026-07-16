// The RN app talks to the same Worker the PWA does, but the whole domain is
// gated by Cloudflare Access. The PWA authenticates via an interactive
// browser login; a native client can't do that, so instead it authenticates
// as a Cloudflare Access Service Token, scoped (in the CF dashboard) to just
// the paths this app needs - see the migration plan for the exact Access
// application/policy setup, which is a manual dashboard step, not code.
export const API_HOST = "grocy.notesane.workers.dev";
export const API_BASE_URL = `https://${API_HOST}`;

const ACCESS_CLIENT_ID = process.env.EXPO_PUBLIC_CF_ACCESS_CLIENT_ID;
const ACCESS_CLIENT_SECRET = process.env.EXPO_PUBLIC_CF_ACCESS_CLIENT_SECRET;

export function accessHeaders(): Record<string, string> {
	if (!ACCESS_CLIENT_ID || !ACCESS_CLIENT_SECRET) {
		throw new Error(
			"Missing EXPO_PUBLIC_CF_ACCESS_CLIENT_ID / EXPO_PUBLIC_CF_ACCESS_CLIENT_SECRET - copy mobile/.env.example to mobile/.env and fill in the Cloudflare Access service token.",
		);
	}
	return {
		"CF-Access-Client-Id": ACCESS_CLIENT_ID,
		"CF-Access-Client-Secret": ACCESS_CLIENT_SECRET,
	};
}
