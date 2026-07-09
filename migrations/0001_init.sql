CREATE TABLE lists (
	id TEXT PRIMARY KEY,
	created_at INTEGER NOT NULL,
	transcript TEXT
);

CREATE TABLE items (
	id TEXT PRIMARY KEY,
	list_id TEXT NOT NULL REFERENCES lists (id),
	name TEXT NOT NULL,
	quantity TEXT,
	category TEXT NOT NULL,
	ticked INTEGER NOT NULL DEFAULT 0,
	sort_order INTEGER NOT NULL
);

CREATE INDEX idx_items_list_id ON items (list_id);
