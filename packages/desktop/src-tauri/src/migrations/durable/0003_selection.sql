CREATE TABLE selection_preferences (
    id           INTEGER PRIMARY KEY CHECK (id = 1),
    mode_enabled INTEGER NOT NULL DEFAULT 0 CHECK (mode_enabled IN (0, 1)),
    updated_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE selection_entries (
    package_key   TEXT NOT NULL,
    entry_key     TEXT NOT NULL,
    locator       TEXT NOT NULL,
    relative_path TEXT NOT NULL,
    selected_at   TEXT NOT NULL,
    last_seen_at  TEXT,
    PRIMARY KEY (package_key, entry_key)
) STRICT;

CREATE INDEX idx_selection_entries_package
    ON selection_entries(package_key, selected_at);

INSERT INTO selection_preferences (id, mode_enabled) VALUES (1, 0);
