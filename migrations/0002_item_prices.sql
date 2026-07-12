-- Estimated price per item, filled in once at finalize time via a
-- web-search-grounded model call - nullable since pricing is best-effort
-- and some items may not get a confident estimate.
ALTER TABLE items ADD COLUMN estimated_price REAL;
