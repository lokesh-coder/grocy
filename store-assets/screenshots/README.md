# Play Store screenshots

Faithful static recreations of the real app screens (same colors, fonts,
Tamil copy, and Phosphor icons as `mobile/`), rendered to 1080×1920 PNGs -
not a screen recording of the running app, but not a fabricated marketing
graphic either. Google Play requires screenshots to represent actual app
functionality; these mirror `RecordingScreen.tsx`'s real states rather than
inventing UI that doesn't exist.

- `1-empty.png` - idle state, mic + quick-add chips
- `2-recording.png` - live segments while speaking
- `3-finished.png` - draft list right after "Done"
- `4-organized.png` - categorized + priced, after "Organize"

## Regenerate

Source in `src/`. Needs Playwright (`npm install playwright` in this
folder, then `npx playwright install chromium` once):

```bash
cd store-assets/screenshots/src
node capture.js
```

Outputs land next to the HTML files in `src/` - copy the PNGs up to
`store-assets/screenshots/` afterward.
