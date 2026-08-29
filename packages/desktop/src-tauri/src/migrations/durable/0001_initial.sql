CREATE TABLE settings_documents (
    id             INTEGER PRIMARY KEY CHECK (id = 1),
    schema_version INTEGER NOT NULL CHECK (schema_version > 0),
    payload        TEXT    NOT NULL CHECK (json_valid(payload)),
    updated_at     TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE source_preferences (
    origin_path     TEXT    PRIMARY KEY,
    is_pinned       INTEGER NOT NULL DEFAULT 0 CHECK (is_pinned IN (0, 1)),
    policy_override TEXT    CHECK (
        policy_override IS NULL OR json_valid(policy_override)
    ),
    updated_at      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE archive_secret_refs (
    archive_path TEXT PRIMARY KEY,
    vault_key    TEXT NOT NULL,
    updated_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;
