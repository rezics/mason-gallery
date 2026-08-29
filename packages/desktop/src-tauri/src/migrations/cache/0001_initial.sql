CREATE TABLE sources (
    id                   INTEGER PRIMARY KEY,
    kind                 TEXT    NOT NULL CHECK (kind IN ('archive', 'folder')),
    origin_path          TEXT    UNIQUE NOT NULL,
    identity_segment     TEXT    NOT NULL,
    size_hint            INTEGER,
    content_hash         TEXT    NOT NULL,
    is_solid             INTEGER NOT NULL DEFAULT 0 CHECK (is_solid IN (0, 1)),
    entry_count          INTEGER,
    thumb_cache_size     INTEGER NOT NULL DEFAULT 0 CHECK (thumb_cache_size >= 0),
    extracted_cache_size INTEGER NOT NULL DEFAULT 0 CHECK (extracted_cache_size >= 0),
    last_accessed        TEXT,
    created_at           TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE INDEX idx_sources_migration
    ON sources(identity_segment, size_hint);

CREATE TABLE thumbnails (
    id         INTEGER PRIMARY KEY,
    source_id  INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    entry_path TEXT    NOT NULL,
    width      INTEGER NOT NULL CHECK (width > 0),
    height     INTEGER NOT NULL CHECK (height > 0),
    thumb_path TEXT    NOT NULL,
    file_size  INTEGER CHECK (file_size IS NULL OR file_size >= 0),
    UNIQUE(source_id, entry_path, width)
) STRICT;

CREATE INDEX idx_thumbnails_source_entry
    ON thumbnails(source_id, entry_path);

CREATE TABLE extracted (
    id            INTEGER PRIMARY KEY,
    source_id     INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    entry_path    TEXT    NOT NULL,
    extract_path  TEXT    NOT NULL,
    file_size     INTEGER NOT NULL CHECK (file_size >= 0),
    last_accessed TEXT,
    UNIQUE(source_id, entry_path)
) STRICT;
