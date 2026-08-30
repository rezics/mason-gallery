CREATE TABLE library_sources (
    id              INTEGER PRIMARY KEY,
    kind            TEXT    NOT NULL CHECK (kind IN ('archive', 'folder')),
    origin_path     TEXT    NOT NULL,
    path_key        TEXT    NOT NULL UNIQUE,
    display_name    TEXT    NOT NULL CHECK (length(trim(display_name)) > 0),
    is_favorite     INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1)),
    added_at        TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_opened_at  TEXT,
    last_scanned_at TEXT,
    image_count     INTEGER CHECK (image_count IS NULL OR image_count >= 0)
) STRICT;

CREATE INDEX idx_library_sources_favorite
    ON library_sources(is_favorite, last_opened_at);
