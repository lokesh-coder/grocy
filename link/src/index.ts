// Public, unauthenticated - deliberately not behind the same Cloudflare
// Access that protects grocy.notesane.workers.dev, since the whole point is
// that tapping a shared link redirects into the Android app immediately,
// with no login step in the way. Nothing sensitive lives here: this Worker
// never touches D1 or the app's API, it only knows the slug already present
// in the URL and bounces to the app - the actual list data still requires
// the app's own authenticated API call to load.
const APP_PACKAGE = "com.anonymous.mobile";

// Matches nanoid(10)'s default alphabet - anything else is rejected rather
// than reflected into the HTML/JS response below.
const SLUG_PATTERN = /^[A-Za-z0-9_-]+$/;

function page(slug: string): string {
	const encoded = encodeURIComponent(slug);
	const intentUrl = `intent://list/${encoded}#Intent;scheme=grocy;package=${APP_PACKAGE};end`;
	const schemeUrl = `grocy://list/${encoded}`;
	return `<!DOCTYPE html>
<html lang="ta">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>மளிகை பட்டியல்</title>
<script>window.location.href = ${JSON.stringify(intentUrl)};</script>
</head>
<body style="font-family: sans-serif; text-align: center; padding-top: 3rem;">
<p>ஆப் திறக்கவில்லை என்றால்:</p>
<p><a href="${schemeUrl}" style="font-size: 1.2rem;">மளிகை பட்டியலைத் திற</a></p>
</body>
</html>`;
}

export default {
	async fetch(request) {
		const url = new URL(request.url);
		const match = url.pathname.match(/^\/list\/([^/]+)$/);
		if (!match || !SLUG_PATTERN.test(match[1])) {
			return new Response("Not found", { status: 404 });
		}
		return new Response(page(match[1]), { headers: { "content-type": "text/html; charset=utf-8" } });
	},
} satisfies ExportedHandler;
