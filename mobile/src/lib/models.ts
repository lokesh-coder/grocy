// One model, used everywhere - live per-segment parsing while dictating and
// the on-demand categorize+price pass both call this. No more picking
// between a fast/cheap live tier and a stronger final tier (see
// RecordingScreen.tsx): both used to run on a full re-parse of the whole
// transcript-so-far anyway, so there was no quality reason to keep two
// models around - only cost. Switched to the lighter flash-lite tier for
// lower per-call cost given how often the live path calls this.
export const MODEL_ID = "google/gemini-3.1-flash-lite";
