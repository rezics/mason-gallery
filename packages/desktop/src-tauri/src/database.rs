use rusqlite::{params, Connection};
use std::path::Path;
use std::sync::Mutex;

pub const SCHEMA_VERSION: i32 = 2;

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    /// Open or create the cache database at `<cache_dir>/cache.db`.
    ///
    /// Detects pre-v2 schemas (an `archives` table left over from
    /// archive-browsing) and wipes the entire cache directory before
    /// recreating the database on a clean slate. Safe because archive-browsing
    /// never shipped to end users.
    pub fn new(cache_dir: &Path) -> Result<Self, String> {
        std::fs::create_dir_all(cache_dir)
            .map_err(|e| format!("Failed to create cache dir: {}", e))?;

        let db_path = cache_dir.join("cache.db");

        if Self::needs_wipe(&db_path)? {
            // Close any stray handles by scoping-only open, then wipe.
            // SQLite isn't strictly required to be closed on Windows before
            // deletion, but we drop any ephemeral connection that was opened
            // during needs_wipe above (which returns before opening one).
            let _ = std::fs::remove_dir_all(cache_dir);
            std::fs::create_dir_all(cache_dir)
                .map_err(|e| format!("Failed to recreate cache dir: {}", e))?;
            eprintln!(
                "[mason-gallery] Legacy archive-cache schema detected; cache directory wiped."
            );
        }

        let conn =
            Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
            .map_err(|e| format!("Failed to set pragmas: {}", e))?;

        Self::initialize_tables(&conn)?;

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    fn needs_wipe(db_path: &Path) -> Result<bool, String> {
        if !db_path.exists() {
            return Ok(false);
        }
        let conn = Connection::open(db_path).map_err(|e| format!("Failed to probe db: {}", e))?;

        // Legacy schema indicator: presence of `archives` table.
        let archives_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='archives'",
                [],
                |row| Ok(row.get::<_, i64>(0)? > 0),
            )
            .map_err(|e| format!("Failed to probe schema: {}", e))?;

        Ok(archives_exists)
    }

    fn initialize_tables(conn: &Connection) -> Result<(), String> {
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS schema_meta (
                version INTEGER PRIMARY KEY
            );

            CREATE TABLE IF NOT EXISTS sources (
                id                    INTEGER PRIMARY KEY,
                kind                  TEXT    NOT NULL CHECK(kind IN ('archive','folder')),
                origin_path           TEXT    UNIQUE NOT NULL,
                identity_segment      TEXT    NOT NULL,
                size_hint             INTEGER,
                content_hash          TEXT    NOT NULL,
                is_solid              BOOLEAN DEFAULT FALSE,
                is_pinned             BOOLEAN DEFAULT FALSE,
                entry_count           INTEGER,
                thumb_cache_size      INTEGER DEFAULT 0,
                extracted_cache_size  INTEGER DEFAULT 0,
                policy_override       TEXT,
                last_accessed         TIMESTAMP,
                created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_sources_migration
                ON sources(identity_segment, size_hint);

            CREATE TABLE IF NOT EXISTS thumbnails (
                id          INTEGER PRIMARY KEY,
                source_id   INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
                entry_path  TEXT    NOT NULL,
                width       INTEGER NOT NULL,
                height      INTEGER NOT NULL,
                thumb_path  TEXT    NOT NULL,
                file_size   INTEGER,
                UNIQUE(source_id, entry_path, width)
            );

            CREATE INDEX IF NOT EXISTS idx_thumbnails_source_entry
                ON thumbnails(source_id, entry_path);

            CREATE TABLE IF NOT EXISTS extracted (
                id            INTEGER PRIMARY KEY,
                source_id     INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
                entry_path    TEXT    NOT NULL,
                extract_path  TEXT    NOT NULL,
                file_size     INTEGER NOT NULL,
                last_accessed TIMESTAMP,
                UNIQUE(source_id, entry_path)
            );

            CREATE TABLE IF NOT EXISTS passwords (
                archive_path TEXT PRIMARY KEY,
                password     TEXT NOT NULL,
                encrypted    BOOLEAN DEFAULT FALSE
            );",
        )
        .map_err(|e| format!("Failed to create tables: {}", e))?;

        // Record schema version (idempotent: single row enforced by PRIMARY KEY).
        conn.execute(
            "INSERT OR REPLACE INTO schema_meta (version) VALUES (?1)",
            params![SCHEMA_VERSION],
        )
        .map_err(|e| format!("Failed to set schema version: {}", e))?;

        Ok(())
    }

    pub fn with_conn<F, T>(&self, f: F) -> Result<T, String>
    where
        F: FnOnce(&Connection) -> Result<T, rusqlite::Error>,
    {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        f(&conn).map_err(|e| format!("Database error: {}", e))
    }

    // ---- Source operations ----

    pub fn get_source_by_path(&self, origin_path: &str) -> Result<Option<SourceRecord>, String> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, kind, origin_path, identity_segment, size_hint, content_hash, is_solid, is_pinned, entry_count, thumb_cache_size, extracted_cache_size, policy_override, last_accessed
                 FROM sources WHERE origin_path = ?1",
            )?;
            let result = stmt.query_row(params![origin_path], row_to_source);
            match result {
                Ok(rec) => Ok(Some(rec)),
                Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
                Err(e) => Err(e),
            }
        })
    }

    pub fn get_source_by_id(&self, id: i64) -> Result<Option<SourceRecord>, String> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, kind, origin_path, identity_segment, size_hint, content_hash, is_solid, is_pinned, entry_count, thumb_cache_size, extracted_cache_size, policy_override, last_accessed
                 FROM sources WHERE id = ?1",
            )?;
            let result = stmt.query_row(params![id], row_to_source);
            match result {
                Ok(rec) => Ok(Some(rec)),
                Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
                Err(e) => Err(e),
            }
        })
    }

    pub fn upsert_source(&self, params: &UpsertSourceParams<'_>) -> Result<i64, String> {
        self.with_conn(|conn| {
            conn.execute(
                "INSERT INTO sources (kind, origin_path, identity_segment, size_hint, content_hash, is_solid, entry_count, last_accessed)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, CURRENT_TIMESTAMP)
                 ON CONFLICT(origin_path) DO UPDATE SET
                    identity_segment = excluded.identity_segment,
                    size_hint        = excluded.size_hint,
                    content_hash     = excluded.content_hash,
                    is_solid         = excluded.is_solid,
                    entry_count      = excluded.entry_count,
                    last_accessed    = CURRENT_TIMESTAMP",
                rusqlite::params![
                    params.kind,
                    params.origin_path,
                    params.identity_segment,
                    params.size_hint,
                    params.content_hash,
                    params.is_solid,
                    params.entry_count,
                ],
            )?;
            // ON CONFLICT may not update last_insert_rowid — re-query.
            let id: i64 = conn.query_row(
                "SELECT id FROM sources WHERE origin_path = ?1",
                rusqlite::params![params.origin_path],
                |row| row.get(0),
            )?;
            Ok(id)
        })
    }

    pub fn touch_source(&self, source_id: i64) -> Result<(), String> {
        self.with_conn(|conn| {
            conn.execute(
                "UPDATE sources SET last_accessed = CURRENT_TIMESTAMP WHERE id = ?1",
                params![source_id],
            )?;
            Ok(())
        })
    }

    pub fn set_source_pinned(&self, source_id: i64, pinned: bool) -> Result<(), String> {
        self.with_conn(|conn| {
            conn.execute(
                "UPDATE sources SET is_pinned = ?1 WHERE id = ?2",
                params![pinned, source_id],
            )?;
            Ok(())
        })
    }

    pub fn set_source_policy(
        &self,
        source_id: i64,
        policy_json: Option<&str>,
    ) -> Result<(), String> {
        self.with_conn(|conn| {
            conn.execute(
                "UPDATE sources SET policy_override = ?1 WHERE id = ?2",
                params![policy_json, source_id],
            )?;
            Ok(())
        })
    }

    pub fn update_source_path(
        &self,
        source_id: i64,
        new_path: &str,
        new_hash: &str,
    ) -> Result<(), String> {
        self.with_conn(|conn| {
            conn.execute(
                "UPDATE sources SET origin_path = ?1, content_hash = ?2, last_accessed = CURRENT_TIMESTAMP WHERE id = ?3",
                params![new_path, new_hash, source_id],
            )?;
            Ok(())
        })
    }

    pub fn set_thumb_cache_size(&self, source_id: i64, bytes: i64) -> Result<(), String> {
        self.with_conn(|conn| {
            conn.execute(
                "UPDATE sources SET thumb_cache_size = ?1 WHERE id = ?2",
                params![bytes, source_id],
            )?;
            Ok(())
        })
    }

    pub fn set_extracted_cache_size(&self, source_id: i64, bytes: i64) -> Result<(), String> {
        self.with_conn(|conn| {
            conn.execute(
                "UPDATE sources SET extracted_cache_size = ?1 WHERE id = ?2",
                params![bytes, source_id],
            )?;
            Ok(())
        })
    }

    pub fn get_all_sources(&self) -> Result<Vec<SourceRecord>, String> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, kind, origin_path, identity_segment, size_hint, content_hash, is_solid, is_pinned, entry_count, thumb_cache_size, extracted_cache_size, policy_override, last_accessed
                 FROM sources ORDER BY last_accessed DESC",
            )?;
            let rows = stmt.query_map([], row_to_source)?;
            rows.collect::<Result<Vec<_>, _>>()
        })
    }

    pub fn delete_source(&self, source_id: i64) -> Result<(), String> {
        self.with_conn(|conn| {
            conn.execute("DELETE FROM sources WHERE id = ?1", params![source_id])?;
            Ok(())
        })
    }

    pub fn delete_all_sources(&self) -> Result<(), String> {
        self.with_conn(|conn| {
            conn.execute("DELETE FROM sources", [])?;
            Ok(())
        })
    }

    pub fn delete_unpinned_sources(&self) -> Result<Vec<SourceRecord>, String> {
        let records = self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, kind, origin_path, identity_segment, size_hint, content_hash, is_solid, is_pinned, entry_count, thumb_cache_size, extracted_cache_size, policy_override, last_accessed
                 FROM sources WHERE is_pinned = FALSE",
            )?;
            let rows = stmt.query_map([], row_to_source)?;
            rows.collect::<Result<Vec<_>, _>>()
        })?;

        self.with_conn(|conn| {
            conn.execute("DELETE FROM sources WHERE is_pinned = FALSE", [])?;
            Ok(())
        })?;

        Ok(records)
    }

    pub fn find_migration_candidates(
        &self,
        identity_segment: &str,
        size_hint: Option<i64>,
    ) -> Result<Vec<SourceRecord>, String> {
        self.with_conn(|conn| match size_hint {
            Some(size) => {
                let mut stmt = conn.prepare(
                    "SELECT id, kind, origin_path, identity_segment, size_hint, content_hash, is_solid, is_pinned, entry_count, thumb_cache_size, extracted_cache_size, policy_override, last_accessed
                     FROM sources WHERE identity_segment = ?1 AND size_hint = ?2",
                )?;
                let rows = stmt.query_map(params![identity_segment, size], row_to_source)?;
                rows.collect::<Result<Vec<_>, _>>()
            }
            None => {
                let mut stmt = conn.prepare(
                    "SELECT id, kind, origin_path, identity_segment, size_hint, content_hash, is_solid, is_pinned, entry_count, thumb_cache_size, extracted_cache_size, policy_override, last_accessed
                     FROM sources WHERE identity_segment = ?1 AND size_hint IS NULL",
                )?;
                let rows = stmt.query_map(params![identity_segment], row_to_source)?;
                rows.collect::<Result<Vec<_>, _>>()
            }
        })
    }

    // ---- Thumbnail operations ----

    pub fn insert_thumbnail(
        &self,
        source_id: i64,
        entry_path: &str,
        width: u32,
        height: u32,
        thumb_path: &str,
        file_size: i64,
    ) -> Result<(), String> {
        self.with_conn(|conn| {
            conn.execute(
                "INSERT OR REPLACE INTO thumbnails (source_id, entry_path, width, height, thumb_path, file_size)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![source_id, entry_path, width, height, thumb_path, file_size],
            )?;
            Ok(())
        })
    }

    pub fn get_thumbnail(
        &self,
        source_id: i64,
        entry_path: &str,
        width: u32,
    ) -> Result<Option<ThumbnailRecord>, String> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, source_id, entry_path, width, height, thumb_path, file_size
                 FROM thumbnails WHERE source_id = ?1 AND entry_path = ?2 AND width = ?3",
            )?;
            let result = stmt.query_row(params![source_id, entry_path, width], row_to_thumb);
            match result {
                Ok(rec) => Ok(Some(rec)),
                Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
                Err(e) => Err(e),
            }
        })
    }

    pub fn get_thumbnails_by_entry(
        &self,
        source_id: i64,
        entry_path: &str,
    ) -> Result<Vec<ThumbnailRecord>, String> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, source_id, entry_path, width, height, thumb_path, file_size
                 FROM thumbnails WHERE source_id = ?1 AND entry_path = ?2
                 ORDER BY width ASC",
            )?;
            let rows = stmt.query_map(params![source_id, entry_path], row_to_thumb)?;
            rows.collect::<Result<Vec<_>, _>>()
        })
    }

    pub fn get_all_thumbnails_for_source(
        &self,
        source_id: i64,
    ) -> Result<Vec<ThumbnailRecord>, String> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, source_id, entry_path, width, height, thumb_path, file_size
                 FROM thumbnails WHERE source_id = ?1",
            )?;
            let rows = stmt.query_map(params![source_id], row_to_thumb)?;
            rows.collect::<Result<Vec<_>, _>>()
        })
    }

    pub fn delete_thumbnails_for_source(&self, source_id: i64) -> Result<(), String> {
        self.with_conn(|conn| {
            conn.execute(
                "DELETE FROM thumbnails WHERE source_id = ?1",
                params![source_id],
            )?;
            Ok(())
        })
    }

    pub fn delete_all_thumbnails(&self) -> Result<(), String> {
        self.with_conn(|conn| {
            conn.execute("DELETE FROM thumbnails", [])?;
            conn.execute("UPDATE sources SET thumb_cache_size = 0", [])?;
            Ok(())
        })
    }

    // ---- Extracted operations ----

    pub fn insert_extracted(
        &self,
        source_id: i64,
        entry_path: &str,
        extract_path: &str,
        file_size: i64,
    ) -> Result<(), String> {
        self.with_conn(|conn| {
            conn.execute(
                "INSERT OR REPLACE INTO extracted (source_id, entry_path, extract_path, file_size, last_accessed)
                 VALUES (?1, ?2, ?3, ?4, CURRENT_TIMESTAMP)",
                params![source_id, entry_path, extract_path, file_size],
            )?;
            Ok(())
        })
    }

    pub fn get_extracted(
        &self,
        source_id: i64,
        entry_path: &str,
    ) -> Result<Option<ExtractedRecord>, String> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, source_id, entry_path, extract_path, file_size, last_accessed
                 FROM extracted WHERE source_id = ?1 AND entry_path = ?2",
            )?;
            let result = stmt.query_row(params![source_id, entry_path], row_to_extracted);
            match result {
                Ok(rec) => Ok(Some(rec)),
                Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
                Err(e) => Err(e),
            }
        })
    }

    pub fn touch_extracted(&self, source_id: i64, entry_path: &str) -> Result<(), String> {
        self.with_conn(|conn| {
            conn.execute(
                "UPDATE extracted SET last_accessed = CURRENT_TIMESTAMP WHERE source_id = ?1 AND entry_path = ?2",
                params![source_id, entry_path],
            )?;
            Ok(())
        })
    }

    pub fn get_all_extracted_for_source(
        &self,
        source_id: i64,
    ) -> Result<Vec<ExtractedRecord>, String> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, source_id, entry_path, extract_path, file_size, last_accessed
                 FROM extracted WHERE source_id = ?1 ORDER BY last_accessed ASC",
            )?;
            let rows = stmt.query_map(params![source_id], row_to_extracted)?;
            rows.collect::<Result<Vec<_>, _>>()
        })
    }

    pub fn delete_extracted(&self, source_id: i64, entry_path: &str) -> Result<(), String> {
        self.with_conn(|conn| {
            conn.execute(
                "DELETE FROM extracted WHERE source_id = ?1 AND entry_path = ?2",
                params![source_id, entry_path],
            )?;
            Ok(())
        })
    }

    pub fn delete_extracted_for_source(&self, source_id: i64) -> Result<(), String> {
        self.with_conn(|conn| {
            conn.execute(
                "DELETE FROM extracted WHERE source_id = ?1",
                params![source_id],
            )?;
            Ok(())
        })
    }

    pub fn delete_all_extracted(&self) -> Result<(), String> {
        self.with_conn(|conn| {
            conn.execute("DELETE FROM extracted", [])?;
            conn.execute("UPDATE sources SET extracted_cache_size = 0", [])?;
            Ok(())
        })
    }

    // ---- Password operations (unchanged schema) ----

    pub fn get_password(&self, archive_path: &str) -> Result<Option<PasswordRecord>, String> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT archive_path, password, encrypted FROM passwords WHERE archive_path = ?1",
            )?;
            let result = stmt.query_row(params![archive_path], |row| {
                Ok(PasswordRecord {
                    archive_path: row.get(0)?,
                    password: row.get(1)?,
                    encrypted: row.get(2)?,
                })
            });
            match result {
                Ok(rec) => Ok(Some(rec)),
                Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
                Err(e) => Err(e),
            }
        })
    }

    pub fn save_password(
        &self,
        archive_path: &str,
        password: &str,
        encrypted: bool,
    ) -> Result<(), String> {
        self.with_conn(|conn| {
            conn.execute(
                "INSERT OR REPLACE INTO passwords (archive_path, password, encrypted) VALUES (?1, ?2, ?3)",
                params![archive_path, password, encrypted],
            )?;
            Ok(())
        })
    }

    pub fn delete_password(&self, archive_path: &str) -> Result<(), String> {
        self.with_conn(|conn| {
            conn.execute(
                "DELETE FROM passwords WHERE archive_path = ?1",
                params![archive_path],
            )?;
            Ok(())
        })
    }

    pub fn delete_all_passwords(&self) -> Result<(), String> {
        self.with_conn(|conn| {
            conn.execute("DELETE FROM passwords", [])?;
            Ok(())
        })
    }

    pub fn get_all_passwords(&self) -> Result<Vec<PasswordRecord>, String> {
        self.with_conn(|conn| {
            let mut stmt =
                conn.prepare("SELECT archive_path, password, encrypted FROM passwords")?;
            let rows = stmt.query_map([], |row| {
                Ok(PasswordRecord {
                    archive_path: row.get(0)?,
                    password: row.get(1)?,
                    encrypted: row.get(2)?,
                })
            })?;
            rows.collect::<Result<Vec<_>, _>>()
        })
    }
}

fn row_to_source(row: &rusqlite::Row) -> rusqlite::Result<SourceRecord> {
    Ok(SourceRecord {
        id: row.get(0)?,
        kind: row.get(1)?,
        origin_path: row.get(2)?,
        identity_segment: row.get(3)?,
        size_hint: row.get(4)?,
        content_hash: row.get(5)?,
        is_solid: row.get(6)?,
        is_pinned: row.get(7)?,
        entry_count: row.get(8)?,
        thumb_cache_size: row.get(9)?,
        extracted_cache_size: row.get(10)?,
        policy_override: row.get(11)?,
        last_accessed: row.get(12)?,
    })
}

fn row_to_thumb(row: &rusqlite::Row) -> rusqlite::Result<ThumbnailRecord> {
    Ok(ThumbnailRecord {
        id: row.get(0)?,
        source_id: row.get(1)?,
        entry_path: row.get(2)?,
        width: row.get(3)?,
        height: row.get(4)?,
        thumb_path: row.get(5)?,
        file_size: row.get(6)?,
    })
}

fn row_to_extracted(row: &rusqlite::Row) -> rusqlite::Result<ExtractedRecord> {
    Ok(ExtractedRecord {
        id: row.get(0)?,
        source_id: row.get(1)?,
        entry_path: row.get(2)?,
        extract_path: row.get(3)?,
        file_size: row.get(4)?,
        last_accessed: row.get(5)?,
    })
}

#[derive(Debug, Clone)]
pub struct UpsertSourceParams<'a> {
    pub kind: &'a str,
    pub origin_path: &'a str,
    pub identity_segment: &'a str,
    pub size_hint: Option<i64>,
    pub content_hash: &'a str,
    pub is_solid: bool,
    pub entry_count: Option<i64>,
}

#[derive(Debug, Clone)]
pub struct SourceRecord {
    pub id: i64,
    pub kind: String,
    pub origin_path: String,
    pub identity_segment: String,
    pub size_hint: Option<i64>,
    pub content_hash: String,
    pub is_solid: bool,
    pub is_pinned: bool,
    pub entry_count: Option<i64>,
    pub thumb_cache_size: i64,
    pub extracted_cache_size: i64,
    pub policy_override: Option<String>,
    pub last_accessed: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ThumbnailRecord {
    pub id: i64,
    pub source_id: i64,
    pub entry_path: String,
    pub width: u32,
    pub height: u32,
    pub thumb_path: String,
    pub file_size: Option<i64>,
}

#[derive(Debug, Clone)]
pub struct ExtractedRecord {
    pub id: i64,
    pub source_id: i64,
    pub entry_path: String,
    pub extract_path: String,
    pub file_size: i64,
    pub last_accessed: Option<String>,
}

#[derive(Debug, Clone)]
pub struct PasswordRecord {
    pub archive_path: String,
    pub password: String,
    pub encrypted: bool,
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn new_db() -> (Database, tempfile::TempDir) {
        let dir = tempdir().unwrap();
        let db = Database::new(dir.path()).unwrap();
        (db, dir)
    }

    #[test]
    fn upsert_and_get_source() {
        let (db, _tmp) = new_db();
        let id = db
            .upsert_source(&UpsertSourceParams {
                kind: "archive",
                origin_path: "D:/packs/a.zip",
                identity_segment: "a.zip",
                size_hint: Some(123),
                content_hash: "h1",
                is_solid: false,
                entry_count: Some(4),
            })
            .unwrap();
        let rec = db.get_source_by_id(id).unwrap().unwrap();
        assert_eq!(rec.kind, "archive");
        assert_eq!(rec.identity_segment, "a.zip");
        assert_eq!(rec.size_hint, Some(123));

        let by_path = db.get_source_by_path("D:/packs/a.zip").unwrap().unwrap();
        assert_eq!(by_path.id, id);
    }

    #[test]
    fn folder_source_has_null_size() {
        let (db, _tmp) = new_db();
        let id = db
            .upsert_source(&UpsertSourceParams {
                kind: "folder",
                origin_path: "D:/photos",
                identity_segment: "photos",
                size_hint: None,
                content_hash: "fh1",
                is_solid: false,
                entry_count: None,
            })
            .unwrap();
        let rec = db.get_source_by_id(id).unwrap().unwrap();
        assert!(rec.size_hint.is_none());
        assert_eq!(rec.kind, "folder");
    }

    #[test]
    fn upsert_source_twice_updates() {
        let (db, _tmp) = new_db();
        let id1 = db
            .upsert_source(&UpsertSourceParams {
                kind: "archive",
                origin_path: "D:/p.zip",
                identity_segment: "p.zip",
                size_hint: Some(100),
                content_hash: "h1",
                is_solid: false,
                entry_count: Some(1),
            })
            .unwrap();
        let id2 = db
            .upsert_source(&UpsertSourceParams {
                kind: "archive",
                origin_path: "D:/p.zip",
                identity_segment: "p.zip",
                size_hint: Some(200),
                content_hash: "h2",
                is_solid: true,
                entry_count: Some(2),
            })
            .unwrap();
        assert_eq!(id1, id2);
        let rec = db.get_source_by_id(id1).unwrap().unwrap();
        assert_eq!(rec.size_hint, Some(200));
        assert!(rec.is_solid);
    }

    #[test]
    fn thumbnail_multi_width() {
        let (db, _tmp) = new_db();
        let sid = db
            .upsert_source(&UpsertSourceParams {
                kind: "archive",
                origin_path: "D:/a.zip",
                identity_segment: "a.zip",
                size_hint: Some(1),
                content_hash: "h",
                is_solid: false,
                entry_count: Some(1),
            })
            .unwrap();
        db.insert_thumbnail(sid, "a/b.jpg", 400, 300, "thumbs/h/x_400.webp", 10)
            .unwrap();
        db.insert_thumbnail(sid, "a/b.jpg", 800, 600, "thumbs/h/x_800.webp", 20)
            .unwrap();
        let all = db.get_thumbnails_by_entry(sid, "a/b.jpg").unwrap();
        assert_eq!(all.len(), 2);
        assert_eq!(all[0].width, 400);
        assert_eq!(all[1].width, 800);
    }

    #[test]
    fn extracted_crud() {
        let (db, _tmp) = new_db();
        let sid = db
            .upsert_source(&UpsertSourceParams {
                kind: "archive",
                origin_path: "D:/e.zip",
                identity_segment: "e.zip",
                size_hint: Some(1),
                content_hash: "h",
                is_solid: false,
                entry_count: Some(1),
            })
            .unwrap();
        db.insert_extracted(sid, "e/x.jpg", "extracted/h/x.jpg", 1024)
            .unwrap();
        let rec = db.get_extracted(sid, "e/x.jpg").unwrap().unwrap();
        assert_eq!(rec.file_size, 1024);
        db.touch_extracted(sid, "e/x.jpg").unwrap();
        db.delete_extracted(sid, "e/x.jpg").unwrap();
        assert!(db.get_extracted(sid, "e/x.jpg").unwrap().is_none());
    }

    #[test]
    fn cascading_delete_source_removes_thumbs_and_extracted() {
        let (db, _tmp) = new_db();
        let sid = db
            .upsert_source(&UpsertSourceParams {
                kind: "archive",
                origin_path: "D:/c.zip",
                identity_segment: "c.zip",
                size_hint: Some(1),
                content_hash: "h",
                is_solid: false,
                entry_count: Some(1),
            })
            .unwrap();
        db.insert_thumbnail(sid, "a.jpg", 400, 300, "t", 1).unwrap();
        db.insert_extracted(sid, "a.jpg", "e", 1).unwrap();
        db.delete_source(sid).unwrap();
        assert!(db.get_thumbnail(sid, "a.jpg", 400).unwrap().is_none());
        assert!(db.get_extracted(sid, "a.jpg").unwrap().is_none());
    }

    #[test]
    fn migration_candidates_by_identity_and_size() {
        let (db, _tmp) = new_db();
        db.upsert_source(&UpsertSourceParams {
            kind: "archive",
            origin_path: "D:/old/pack.zip",
            identity_segment: "pack.zip",
            size_hint: Some(900_000_000),
            content_hash: "h1",
            is_solid: false,
            entry_count: Some(10),
        })
        .unwrap();
        db.upsert_source(&UpsertSourceParams {
            kind: "archive",
            origin_path: "D:/other/pack.zip",
            identity_segment: "pack.zip",
            size_hint: Some(500),
            content_hash: "h2",
            is_solid: false,
            entry_count: Some(1),
        })
        .unwrap();
        let cands = db
            .find_migration_candidates("pack.zip", Some(900_000_000))
            .unwrap();
        assert_eq!(cands.len(), 1);
        assert_eq!(cands[0].origin_path, "D:/old/pack.zip");
    }

    #[test]
    fn migration_candidates_folder_null_size() {
        let (db, _tmp) = new_db();
        db.upsert_source(&UpsertSourceParams {
            kind: "folder",
            origin_path: "D:/photos/collection",
            identity_segment: "collection",
            size_hint: None,
            content_hash: "fh",
            is_solid: false,
            entry_count: None,
        })
        .unwrap();
        let cands = db.find_migration_candidates("collection", None).unwrap();
        assert_eq!(cands.len(), 1);
    }

    #[test]
    fn policy_override_roundtrip() {
        let (db, _tmp) = new_db();
        let sid = db
            .upsert_source(&UpsertSourceParams {
                kind: "archive",
                origin_path: "D:/policy.zip",
                identity_segment: "policy.zip",
                size_hint: Some(1),
                content_hash: "h",
                is_solid: false,
                entry_count: Some(1),
            })
            .unwrap();
        let j = r#"{"extracted":{"mode":"no-cache"}}"#;
        db.set_source_policy(sid, Some(j)).unwrap();
        let rec = db.get_source_by_id(sid).unwrap().unwrap();
        assert_eq!(rec.policy_override.as_deref(), Some(j));
        db.set_source_policy(sid, None).unwrap();
        let rec = db.get_source_by_id(sid).unwrap().unwrap();
        assert!(rec.policy_override.is_none());
    }
}
