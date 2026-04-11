use rusqlite::{Connection, params};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn new(app_data_dir: &PathBuf) -> Result<Self, String> {
        std::fs::create_dir_all(app_data_dir)
            .map_err(|e| format!("Failed to create app data dir: {}", e))?;

        let db_path = app_data_dir.join("cache.db");
        let conn = Connection::open(&db_path)
            .map_err(|e| format!("Failed to open database: {}", e))?;

        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
            .map_err(|e| format!("Failed to set pragmas: {}", e))?;

        Self::initialize_tables(&conn)?;

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    fn initialize_tables(conn: &Connection) -> Result<(), String> {
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS archives (
                id            INTEGER PRIMARY KEY,
                archive_path  TEXT UNIQUE NOT NULL,
                filename      TEXT NOT NULL,
                file_size     INTEGER NOT NULL,
                archive_hash  TEXT NOT NULL,
                is_solid      BOOLEAN DEFAULT FALSE,
                is_pinned     BOOLEAN DEFAULT FALSE,
                entry_count   INTEGER,
                cache_size    INTEGER DEFAULT 0,
                last_accessed TIMESTAMP,
                created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_archives_migration
                ON archives(filename, file_size);

            CREATE TABLE IF NOT EXISTS thumbnails (
                id            INTEGER PRIMARY KEY,
                archive_id    INTEGER REFERENCES archives(id) ON DELETE CASCADE,
                entry_path    TEXT NOT NULL,
                thumb_path    TEXT NOT NULL,
                width         INTEGER,
                height        INTEGER,
                file_size     INTEGER,
                UNIQUE(archive_id, entry_path)
            );

            CREATE TABLE IF NOT EXISTS passwords (
                archive_path  TEXT PRIMARY KEY,
                password      TEXT NOT NULL,
                encrypted     BOOLEAN DEFAULT FALSE
            );",
        )
        .map_err(|e| format!("Failed to create tables: {}", e))?;

        Ok(())
    }

    pub fn with_conn<F, T>(&self, f: F) -> Result<T, String>
    where
        F: FnOnce(&Connection) -> Result<T, rusqlite::Error>,
    {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        f(&conn).map_err(|e| format!("Database error: {}", e))
    }

    // --- Archive operations ---

    pub fn get_archive_by_path(&self, archive_path: &str) -> Result<Option<ArchiveRecord>, String> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, archive_path, filename, file_size, archive_hash, is_solid, is_pinned, entry_count, cache_size, last_accessed
                 FROM archives WHERE archive_path = ?1",
            )?;
            let result = stmt.query_row(params![archive_path], |row| {
                Ok(ArchiveRecord {
                    id: row.get(0)?,
                    archive_path: row.get(1)?,
                    filename: row.get(2)?,
                    file_size: row.get(3)?,
                    archive_hash: row.get(4)?,
                    is_solid: row.get(5)?,
                    is_pinned: row.get(6)?,
                    entry_count: row.get(7)?,
                    cache_size: row.get(8)?,
                    last_accessed: row.get(9)?,
                })
            });
            match result {
                Ok(rec) => Ok(Some(rec)),
                Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
                Err(e) => Err(e),
            }
        })
    }

    pub fn upsert_archive(
        &self,
        archive_path: &str,
        filename: &str,
        file_size: i64,
        archive_hash: &str,
        is_solid: bool,
        entry_count: Option<i64>,
    ) -> Result<i64, String> {
        self.with_conn(|conn| {
            conn.execute(
                "INSERT INTO archives (archive_path, filename, file_size, archive_hash, is_solid, entry_count, last_accessed)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, CURRENT_TIMESTAMP)
                 ON CONFLICT(archive_path) DO UPDATE SET
                    filename = excluded.filename,
                    file_size = excluded.file_size,
                    archive_hash = excluded.archive_hash,
                    is_solid = excluded.is_solid,
                    entry_count = excluded.entry_count,
                    last_accessed = CURRENT_TIMESTAMP",
                params![archive_path, filename, file_size, archive_hash, is_solid, entry_count],
            )?;
            Ok(conn.last_insert_rowid())
        })
    }

    pub fn update_archive_cache_size(&self, archive_id: i64, cache_size: i64) -> Result<(), String> {
        self.with_conn(|conn| {
            conn.execute(
                "UPDATE archives SET cache_size = ?1 WHERE id = ?2",
                params![cache_size, archive_id],
            )?;
            Ok(())
        })
    }

    pub fn touch_archive(&self, archive_id: i64) -> Result<(), String> {
        self.with_conn(|conn| {
            conn.execute(
                "UPDATE archives SET last_accessed = CURRENT_TIMESTAMP WHERE id = ?1",
                params![archive_id],
            )?;
            Ok(())
        })
    }

    pub fn set_pinned(&self, archive_id: i64, pinned: bool) -> Result<(), String> {
        self.with_conn(|conn| {
            conn.execute(
                "UPDATE archives SET is_pinned = ?1 WHERE id = ?2",
                params![pinned, archive_id],
            )?;
            Ok(())
        })
    }

    pub fn get_all_archives(&self) -> Result<Vec<ArchiveRecord>, String> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, archive_path, filename, file_size, archive_hash, is_solid, is_pinned, entry_count, cache_size, last_accessed
                 FROM archives ORDER BY last_accessed DESC",
            )?;
            let rows = stmt.query_map([], |row| {
                Ok(ArchiveRecord {
                    id: row.get(0)?,
                    archive_path: row.get(1)?,
                    filename: row.get(2)?,
                    file_size: row.get(3)?,
                    archive_hash: row.get(4)?,
                    is_solid: row.get(5)?,
                    is_pinned: row.get(6)?,
                    entry_count: row.get(7)?,
                    cache_size: row.get(8)?,
                    last_accessed: row.get(9)?,
                })
            })?;
            rows.collect::<Result<Vec<_>, _>>()
        })
    }

    pub fn delete_archive(&self, archive_id: i64) -> Result<(), String> {
        self.with_conn(|conn| {
            conn.execute("DELETE FROM archives WHERE id = ?1", params![archive_id])?;
            Ok(())
        })
    }

    pub fn delete_all_archives(&self) -> Result<(), String> {
        self.with_conn(|conn| {
            conn.execute("DELETE FROM archives", [])?;
            Ok(())
        })
    }

    pub fn delete_unpinned_archives(&self) -> Result<Vec<ArchiveRecord>, String> {
        // Return the records before deleting so we can clean up files
        let records = self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, archive_path, filename, file_size, archive_hash, is_solid, is_pinned, entry_count, cache_size, last_accessed
                 FROM archives WHERE is_pinned = FALSE",
            )?;
            let rows = stmt.query_map([], |row| {
                Ok(ArchiveRecord {
                    id: row.get(0)?,
                    archive_path: row.get(1)?,
                    filename: row.get(2)?,
                    file_size: row.get(3)?,
                    archive_hash: row.get(4)?,
                    is_solid: row.get(5)?,
                    is_pinned: row.get(6)?,
                    entry_count: row.get(7)?,
                    cache_size: row.get(8)?,
                    last_accessed: row.get(9)?,
                })
            })?;
            rows.collect::<Result<Vec<_>, _>>()
        })?;

        self.with_conn(|conn| {
            conn.execute("DELETE FROM archives WHERE is_pinned = FALSE", [])?;
            Ok(())
        })?;

        Ok(records)
    }

    // --- Thumbnail operations ---

    pub fn get_cached_thumbnail(
        &self,
        archive_id: i64,
        entry_path: &str,
    ) -> Result<Option<ThumbnailRecord>, String> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, archive_id, entry_path, thumb_path, width, height, file_size
                 FROM thumbnails WHERE archive_id = ?1 AND entry_path = ?2",
            )?;
            let result = stmt.query_row(params![archive_id, entry_path], |row| {
                Ok(ThumbnailRecord {
                    id: row.get(0)?,
                    archive_id: row.get(1)?,
                    entry_path: row.get(2)?,
                    thumb_path: row.get(3)?,
                    width: row.get(4)?,
                    height: row.get(5)?,
                    file_size: row.get(6)?,
                })
            });
            match result {
                Ok(rec) => Ok(Some(rec)),
                Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
                Err(e) => Err(e),
            }
        })
    }

    pub fn insert_thumbnail(
        &self,
        archive_id: i64,
        entry_path: &str,
        thumb_path: &str,
        width: u32,
        height: u32,
        file_size: i64,
    ) -> Result<(), String> {
        self.with_conn(|conn| {
            conn.execute(
                "INSERT OR REPLACE INTO thumbnails (archive_id, entry_path, thumb_path, width, height, file_size)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![archive_id, entry_path, thumb_path, width, height, file_size],
            )?;
            Ok(())
        })
    }

    pub fn get_all_thumbnails_for_archive(
        &self,
        archive_id: i64,
    ) -> Result<Vec<ThumbnailRecord>, String> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, archive_id, entry_path, thumb_path, width, height, file_size
                 FROM thumbnails WHERE archive_id = ?1",
            )?;
            let rows = stmt.query_map(params![archive_id], |row| {
                Ok(ThumbnailRecord {
                    id: row.get(0)?,
                    archive_id: row.get(1)?,
                    entry_path: row.get(2)?,
                    thumb_path: row.get(3)?,
                    width: row.get(4)?,
                    height: row.get(5)?,
                    file_size: row.get(6)?,
                })
            })?;
            rows.collect::<Result<Vec<_>, _>>()
        })
    }

    // --- Migration operations ---

    pub fn find_migration_candidates(
        &self,
        filename: &str,
        file_size: i64,
    ) -> Result<Vec<ArchiveRecord>, String> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, archive_path, filename, file_size, archive_hash, is_solid, is_pinned, entry_count, cache_size, last_accessed
                 FROM archives WHERE filename = ?1 AND file_size = ?2",
            )?;
            let rows = stmt.query_map(params![filename, file_size], |row| {
                Ok(ArchiveRecord {
                    id: row.get(0)?,
                    archive_path: row.get(1)?,
                    filename: row.get(2)?,
                    file_size: row.get(3)?,
                    archive_hash: row.get(4)?,
                    is_solid: row.get(5)?,
                    is_pinned: row.get(6)?,
                    entry_count: row.get(7)?,
                    cache_size: row.get(8)?,
                    last_accessed: row.get(9)?,
                })
            })?;
            rows.collect::<Result<Vec<_>, _>>()
        })
    }

    pub fn update_archive_path(
        &self,
        archive_id: i64,
        new_path: &str,
        new_hash: &str,
    ) -> Result<(), String> {
        self.with_conn(|conn| {
            conn.execute(
                "UPDATE archives SET archive_path = ?1, archive_hash = ?2 WHERE id = ?3",
                params![new_path, new_hash, archive_id],
            )?;
            Ok(())
        })
    }

    // --- Password operations ---

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
                "INSERT OR REPLACE INTO passwords (archive_path, password, encrypted)
                 VALUES (?1, ?2, ?3)",
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
            let mut stmt = conn.prepare(
                "SELECT archive_path, password, encrypted FROM passwords",
            )?;
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

#[derive(Debug, Clone)]
pub struct ArchiveRecord {
    pub id: i64,
    pub archive_path: String,
    pub filename: String,
    pub file_size: i64,
    pub archive_hash: String,
    pub is_solid: bool,
    pub is_pinned: bool,
    pub entry_count: Option<i64>,
    pub cache_size: i64,
    pub last_accessed: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ThumbnailRecord {
    pub id: i64,
    pub archive_id: i64,
    pub entry_path: String,
    pub thumb_path: String,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub file_size: Option<i64>,
}

#[derive(Debug, Clone)]
pub struct PasswordRecord {
    pub archive_path: String,
    pub password: String,
    pub encrypted: bool,
}
