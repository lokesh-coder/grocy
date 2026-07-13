-- Categorization + price estimation move from finalize-time (blocking the
-- Done button for several seconds) to an on-demand step on the shared list
-- page - this flag tracks whether that step has run yet for a given list.
ALTER TABLE lists ADD COLUMN organized INTEGER NOT NULL DEFAULT 0;
