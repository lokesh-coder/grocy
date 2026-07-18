// One model, used everywhere - live per-segment parsing while dictating and
// the on-demand categorize+price pass both call this. No more picking
// between a fast/cheap live tier and a stronger final tier (see
// RecordingScreen.tsx): both used to run on a full re-parse of the whole
// transcript-so-far anyway, so there was no quality reason to keep two
// models around - only cost, and google/gemini-3.5-flash is fast enough
// live to not need a separate lite tier.
export const MODEL_ID = "google/gemini-3.5-flash";
