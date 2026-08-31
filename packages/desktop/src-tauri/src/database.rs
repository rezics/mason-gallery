use rusqlite::{params, Connection, OptionalExtension, MAIN_DB};
use rusqlite_migration::{Migrations, M};
use std::collections::HashMap;
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

pub const DURABLE_SCHEMA_VERSION: usize = 3;
pub const CACHE_SCHEMA_VERSION: usize = 1;

const CACHE_SOURCE_COLUMNS: &str =
    "id, kind, origin_path, identity_segment, size_hint, content_hash, is_solid, entry_count, thumb_cache_size, extracted_cache_size, last_accessed";

fn durable_migrations() -> Migrations<'static> {
    Migrations::new(vec![
        M::up(include_str!("migrations/durable/0001_initial.sql")),
        M::up(include_str!("migrations/durable/0002_library_sources.sql")),
        M::up(include_str!("migrations/durable/0003_selection.sql")),
    ])
}

fn cache_migrations() -> Migrations<'static> {
    Migrations::new(vec![M::up(include_str!(
        "migrations/cache/0001_initial.sql"
    ))])
}

pub struct Database {
    durable_conn: Mutex<Connection>,
    cache_conn: Mutex<Connection>,
}

pub fn normalize_library_path_key(path: &str) -> String {
    let normalized = path
        .trim()
        .replace('\\', "/")
        .trim_end_matches('/')
        .to_string();
    if cfg!(windows) {
        normalized.to_lowercase()
    } else {
        normalized
    }
}

impl Database {
    /// Opens two databases with deliberately different lifecycles.
    ///
    /// `library.db` lives in app data and is never rebuilt automatically.
    /// `cache.db` lives in the OS cache directory and is safe to recreate.
    pub fn new(data_dir: &Path, cache_dir: &Path) -> Result<Self, String> {
        fs::create_dir_all(data_dir)
            .map_err(|e| format!("Failed to create app data directory: {e}"))?;
        fs::create_dir_all(cache_dir)
            .map_err(|e| format!("Failed to create cache directory: {e}"))?;

        let durable_path = data_dir.join("library.db");
        let cache_path = cache_dir.join("cache.db");
        let durable_conn = Self::open_durable_database(&durable_path)?;
        let cache_conn = Self::open_cache_database(cache_dir, &cache_path)?;

        // The application has not shipped with the old persistence model, so
        // remove its exact artifacts after the new stores are known-good.
        Self::remove_legacy_storage(data_dir, cache_dir, &cache_path)?;

        Ok(Self {
            durable_conn: Mutex::new(durable_conn),
            cache_conn: Mutex::new(cache_conn),
        })
    }

    fn open_durable_database(db_path: &Path) -> Result<Connection, String> {
        let existed = db_path.exists();
        let mut conn = Connection::open(db_path)
            .map_err(|e| format!("Failed to open durable database: {e}"))?;
        Self::configure_connection(&conn, true)?;

        let migrations = durable_migrations();
        migrations
            .validate()
            .map_err(|e| format!("Invalid durable migration set: {e}"))?;
        let pending = migrations
            .pending_migrations(&conn)
            .map_err(|e| format!("Failed to inspect durable migrations: {e}"))?;

        if existed && pending != 0 {
            let stamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis();
            let backup_path = db_path.with_file_name(format!("library-{stamp}.backup.db"));
            conn.backup(MAIN_DB, &backup_path, None)
                .map_err(|e| format!("Failed to back up durable database: {e}"))?;
            eprintln!(
                "[mason-gallery] Durable database backed up before migration: {}",
                backup_path.display()
            );
        }

        migrations
            .to_latest(&mut conn)
            .map_err(|e| format!("Failed to migrate durable database: {e}"))?;
        Ok(conn)
    }

    fn open_cache_database(cache_dir: &Path, db_path: &Path) -> Result<Connection, String> {
        match Self::try_open_cache_database(db_path) {
            Ok(conn) => Ok(conn),
            Err(first_error) => {
                Self::reset_cache_storage(cache_dir, db_path)?;
                eprintln!(
                    "[mason-gallery] Disposable cache database rebuilt after migration/open error: {first_error}"
                );
                Self::try_open_cache_database(db_path).map_err(|second_error| {
                    format!(
                        "Failed to rebuild cache database after '{first_error}': {second_error}"
                    )
                })
            }
        }
    }

    fn try_open_cache_database(db_path: &Path) -> Result<Connection, String> {
        let mut conn =
            Connection::open(db_path).map_err(|e| format!("Failed to open cache database: {e}"))?;
        Self::configure_connection(&conn, false)?;

        let migrations = cache_migrations();
        migrations
            .validate()
            .map_err(|e| format!("Invalid cache migration set: {e}"))?;
        migrations
            .to_latest(&mut conn)
            .map_err(|e| format!("Failed to migrate cache database: {e}"))?;
        Ok(conn)
    }

    fn configure_connection(conn: &Connection, durable: bool) -> Result<(), String> {
        conn.pragma_update(None, "journal_mode", "WAL")
            .map_err(|e| format!("Failed to enable WAL: {e}"))?;
        conn.pragma_update(None, "synchronous", if durable { "FULL" } else { "NORMAL" })
            .map_err(|e| format!("Failed to configure synchronous mode: {e}"))?;
        conn.pragma_update(None, "foreign_keys", "ON")
            .map_err(|e| format!("Failed to enable foreign keys: {e}"))?;
        conn.busy_timeout(Duration::from_secs(5))
            .map_err(|e| format!("Failed to configure SQLite busy timeout: {e}"))?;
        Ok(())
    }

    fn sqlite_sidecar(db_path: &Path, suffix: &str) -> PathBuf {
        let mut path = db_path.as_os_str().to_os_string();
        path.push(suffix);
        PathBuf::from(path)
    }

    fn remove_file_if_present(path: &Path) -> Result<(), String> {
        match fs::remove_file(path) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
            Err(error) => Err(format!("Failed to remove {}: {error}", path.display())),
        }
    }

    fn remove_dir_if_present(path: &Path) -> Result<(), String> {
        match fs::remove_dir_all(path) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
            Err(error) => Err(format!("Failed to remove {}: {error}", path.display())),
        }
    }

    fn remove_sqlite_files(db_path: &Path) -> Result<(), String> {
        Self::remove_file_if_present(db_path)?;
        Self::remove_file_if_present(&Self::sqlite_sidecar(db_path, "-wal"))?;
        Self::remove_file_if_present(&Self::sqlite_sidecar(db_path, "-shm"))?;
        Ok(())
    }

    fn reset_cache_storage(cache_dir: &Path, db_path: &Path) -> Result<(), String> {
        if db_path.parent() != Some(cache_dir) {
            return Err(format!(
                "Refusing to reset cache database outside {}",
                cache_dir.display()
            ));
        }
        Self::remove_sqlite_files(db_path)?;

        for child in ["thumbs", "extracted"] {
            let target = cache_dir.join(child);
            if target.parent() != Some(cache_dir) {
                return Err(format!(
                    "Refusing to reset cache path outside {}",
                    cache_dir.display()
                ));
            }
            Self::remove_dir_if_present(&target)?;
        }
        Ok(())
    }

    fn remove_legacy_storage(
        data_dir: &Path,
        cache_dir: &Path,
        cache_path: &Path,
    ) -> Result<(), String> {
        let legacy_db = data_dir.join("cache.db");
        if legacy_db != cache_path {
            Self::remove_sqlite_files(&legacy_db)?;
        }
        Self::remove_file_if_present(&data_dir.join("settings.json"))?;

        let legacy_cache_dir = data_dir.join("archive-cache");
        if legacy_cache_dir != cache_dir && legacy_cache_dir.parent() == Some(data_dir) {
            Self::remove_dir_if_present(&legacy_cache_dir)?;
        }
        Ok(())
    }

    fn with_durable_conn<F, T>(&self, f: F) -> Result<T, String>
    where
        F: FnOnce(&Connection) -> Result<T, rusqlite::Error>,
    {
        let conn = self
            .durable_conn
            .lock()
            .map_err(|e| format!("Durable database lock error: {e}"))?;
        f(&conn).map_err(|e| format!("Durable database error: {e}"))
    }

    fn with_durable_conn_mut<F, T>(&self, f: F) -> Result<T, String>
    where
        F: FnOnce(&mut Connection) -> Result<T, rusqlite::Error>,
    {
        let mut conn = self
            .durable_conn
            .lock()
            .map_err(|e| format!("Durable database lock error: {e}"))?;
        f(&mut conn).map_err(|e| format!("Durable database error: {e}"))
    }

    fn with_cache_conn<F, T>(&self, f: F) -> Result<T, String>
    where
        F: FnOnce(&Connection) -> Result<T, rusqlite::Error>,
    {
        let conn = self
            .cache_conn
            .lock()
            .map_err(|e| format!("Cache database lock error: {e}"))?;
        f(&conn).map_err(|e| format!("Cache database error: {e}"))
    }

    fn with_cache_conn_mut<F, T>(&self, f: F) -> Result<T, String>
    where
        F: FnOnce(&mut Connection) -> Result<T, rusqlite::Error>,
    {
        let mut conn = self
            .cache_conn
            .lock()
            .map_err(|e| format!("Cache database lock error: {e}"))?;
        f(&mut conn).map_err(|e| format!("Cache database error: {e}"))
    }

    // ---- Durable settings document ----

    pub fn load_settings_document(&self) -> Result<Option<String>, String> {
        self.with_durable_conn(|conn| {
            conn.query_row(
                "SELECT payload FROM settings_documents WHERE id = 1",
                [],
                |row| row.get(0),
            )
            .optional()
        })
    }

    pub fn save_settings_document(
        &self,
        schema_version: i64,
        document: &str,
    ) -> Result<(), String> {
        self.with_durable_conn(|conn| {
            conn.execute(
                "INSERT INTO settings_documents (id, schema_version, payload, updated_at)
                 VALUES (1, ?1, ?2, CURRENT_TIMESTAMP)
                 ON CONFLICT(id) DO UPDATE SET
                    schema_version = excluded.schema_version,
                    payload = excluded.payload,
                    updated_at = CURRENT_TIMESTAMP",
                params![schema_version, document],
            )?;
            Ok(())
        })
    }

    // ---- Durable gallery library ----

    pub fn get_library_sources(&self) -> Result<Vec<LibrarySourceRecord>, String> {
        self.with_durable_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, kind, origin_path, display_name, is_favorite,
                        added_at, last_opened_at, last_scanned_at, image_count
                 FROM library_sources
                 ORDER BY
                    CASE WHEN last_opened_at IS NULL THEN 1 ELSE 0 END,
                    last_opened_at DESC,
                    display_name COLLATE NOCASE ASC",
            )?;
            let rows = stmt.query_map([], row_to_library_source)?;
            rows.collect()
        })
    }

    pub fn get_library_source_by_id(&self, id: i64) -> Result<Option<LibrarySourceRecord>, String> {
        self.with_durable_conn(|conn| {
            conn.query_row(
                "SELECT id, kind, origin_path, display_name, is_favorite,
                        added_at, last_opened_at, last_scanned_at, image_count
                 FROM library_sources
                 WHERE id = ?1",
                params![id],
                row_to_library_source,
            )
            .optional()
        })
    }

    pub fn upsert_library_sources(
        &self,
        sources: &[UpsertLibrarySourceParams<'_>],
    ) -> Result<Vec<LibrarySourceRecord>, String> {
        self.with_durable_conn_mut(|conn| {
            let tx = conn.transaction()?;
            for source in sources {
                tx.execute(
                    "INSERT INTO library_sources (
                        kind, origin_path, path_key, display_name, last_opened_at
                     )
                     VALUES (?1, ?2, ?3, ?4, ?5)
                     ON CONFLICT(path_key) DO UPDATE SET
                        kind = excluded.kind,
                        origin_path = excluded.origin_path,
                        last_opened_at = COALESCE(
                            excluded.last_opened_at,
                            library_sources.last_opened_at
                        )",
                    params![
                        source.kind,
                        source.origin_path,
                        source.path_key,
                        source.display_name,
                        source.last_opened_at,
                    ],
                )?;
            }
            tx.commit()
        })?;
        self.get_library_sources()
    }

    pub fn update_library_source(
        &self,
        id: i64,
        display_name: Option<&str>,
        is_favorite: Option<bool>,
    ) -> Result<Vec<LibrarySourceRecord>, String> {
        self.with_durable_conn(|conn| {
            conn.execute(
                "UPDATE library_sources
                 SET display_name = COALESCE(?1, display_name),
                     is_favorite = COALESCE(?2, is_favorite)
                 WHERE id = ?3",
                params![
                    display_name,
                    is_favorite.map(|value| if value { 1 } else { 0 }),
                    id,
                ],
            )?;
            Ok(())
        })?;
        self.get_library_sources()
    }

    pub fn remove_library_sources(&self, ids: &[i64]) -> Result<Vec<LibrarySourceRecord>, String> {
        self.with_durable_conn_mut(|conn| {
            let tx = conn.transaction()?;
            for id in ids {
                tx.execute("DELETE FROM library_sources WHERE id = ?1", params![id])?;
            }
            tx.commit()
        })?;
        self.get_library_sources()
    }

    pub fn mark_library_sources_scanned(
        &self,
        path_keys: &[String],
        image_count: Option<i64>,
    ) -> Result<(), String> {
        self.with_durable_conn_mut(|conn| {
            let tx = conn.transaction()?;
            for path_key in path_keys {
                tx.execute(
                    "UPDATE library_sources
                     SET last_scanned_at = CURRENT_TIMESTAMP,
                         image_count = COALESCE(?1, image_count)
                     WHERE path_key = ?2",
                    params![image_count, path_key],
                )?;
            }
            tx.commit()
        })
    }

    // ---- Persistent multi-select ----

    pub fn load_selection_state(&self) -> Result<(bool, Vec<SelectionEntryRecord>), String> {
        self.with_durable_conn(|conn| {
            let mode_enabled: i64 = conn
                .query_row(
                    "SELECT mode_enabled FROM selection_preferences WHERE id = 1",
                    [],
                    |row| row.get(0),
                )
                .optional()?
                .unwrap_or(0);
            let mut stmt = conn.prepare(
                "SELECT package_key, entry_key, locator, relative_path, selected_at, last_seen_at
                 FROM selection_entries
                 ORDER BY selected_at ASC, entry_key ASC",
            )?;
            let rows = stmt.query_map([], row_to_selection_entry)?;
            let entries = rows.collect::<Result<Vec<_>, _>>()?;
            Ok((mode_enabled != 0, entries))
        })
    }

    pub fn save_selection_mode(&self, enabled: bool) -> Result<(), String> {
        self.with_durable_conn(|conn| {
            conn.execute(
                "INSERT INTO selection_preferences (id, mode_enabled, updated_at)
                 VALUES (1, ?1, CURRENT_TIMESTAMP)
                 ON CONFLICT(id) DO UPDATE SET
                    mode_enabled = excluded.mode_enabled,
                    updated_at = CURRENT_TIMESTAMP",
                params![if enabled { 1 } else { 0 }],
            )?;
            Ok(())
        })
    }

    pub fn upsert_selection_entries(&self, entries: &[SelectionEntryRecord]) -> Result<(), String> {
        self.with_durable_conn_mut(|conn| {
            let tx = conn.transaction()?;
            upsert_selection_entries_in_tx(&tx, entries)?;
            tx.commit()
        })
    }

    pub fn remove_selection_entries(&self, keys: &[(String, String)]) -> Result<(), String> {
        self.with_durable_conn_mut(|conn| {
            let tx = conn.transaction()?;
            remove_selection_entries_in_tx(&tx, keys)?;
            tx.commit()
        })
    }

    pub fn clear_selection_package(&self, package_key: &str) -> Result<(), String> {
        self.with_durable_conn(|conn| {
            conn.execute(
                "DELETE FROM selection_entries WHERE package_key = ?1",
                params![package_key],
            )?;
            Ok(())
        })
    }

    pub fn clear_all_selections(&self) -> Result<(), String> {
        self.with_durable_conn(|conn| {
            conn.execute("DELETE FROM selection_entries", [])?;
            Ok(())
        })
    }

    pub fn replace_selection_entries(
        &self,
        remove: &[(String, String)],
        insert: &[SelectionEntryRecord],
    ) -> Result<(), String> {
        self.with_durable_conn_mut(|conn| {
            let tx = conn.transaction()?;
            remove_selection_entries_in_tx(&tx, remove)?;
            upsert_selection_entries_in_tx(&tx, insert)?;
            tx.commit()
        })
    }

    pub fn commit_selection_mutation(
        &self,
        mode_enabled: Option<bool>,
        upsert: &[SelectionEntryRecord],
        remove: &[(String, String)],
    ) -> Result<(), String> {
        self.with_durable_conn_mut(|conn| {
            let tx = conn.transaction()?;
            if let Some(enabled) = mode_enabled {
                tx.execute(
                    "INSERT INTO selection_preferences (id, mode_enabled, updated_at)
                     VALUES (1, ?1, CURRENT_TIMESTAMP)
                     ON CONFLICT(id) DO UPDATE SET
                        mode_enabled = excluded.mode_enabled,
                        updated_at = CURRENT_TIMESTAMP",
                    params![if enabled { 1 } else { 0 }],
                )?;
            }
            remove_selection_entries_in_tx(&tx, remove)?;
            upsert_selection_entries_in_tx(&tx, upsert)?;
            tx.commit()
        })
    }

    // ---- Cache source operations + durable source preferences ----

    fn get_source_preference(&self, origin_path: &str) -> Result<SourcePreference, String> {
        self.with_durable_conn(|conn| {
            conn.query_row(
                "SELECT is_pinned, policy_override
                 FROM source_preferences WHERE origin_path = ?1",
                params![origin_path],
                |row| {
                    Ok(SourcePreference {
                        is_pinned: row.get::<_, i64>(0)? != 0,
                        policy_override: row.get(1)?,
                    })
                },
            )
            .optional()
            .map(|value| value.unwrap_or_default())
        })
    }

    fn get_all_source_preferences(&self) -> Result<HashMap<String, SourcePreference>, String> {
        self.with_durable_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT origin_path, is_pinned, policy_override FROM source_preferences",
            )?;
            let rows = stmt.query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    SourcePreference {
                        is_pinned: row.get::<_, i64>(1)? != 0,
                        policy_override: row.get(2)?,
                    },
                ))
            })?;
            rows.collect::<Result<HashMap<_, _>, _>>()
        })
    }

    fn enrich_source(&self, cached: CachedSourceRecord) -> Result<SourceRecord, String> {
        let preference = self.get_source_preference(&cached.origin_path)?;
        Ok(cached.with_preference(preference))
    }

    fn enrich_sources(&self, cached: Vec<CachedSourceRecord>) -> Result<Vec<SourceRecord>, String> {
        let preferences = self.get_all_source_preferences()?;
        Ok(cached
            .into_iter()
            .map(|record| {
                let preference = preferences
                    .get(&record.origin_path)
                    .cloned()
                    .unwrap_or_default();
                record.with_preference(preference)
            })
            .collect())
    }

    fn get_cached_source_by_id(&self, id: i64) -> Result<Option<CachedSourceRecord>, String> {
        self.with_cache_conn(|conn| {
            let sql = format!("SELECT {CACHE_SOURCE_COLUMNS} FROM sources WHERE id = ?1");
            conn.query_row(&sql, params![id], row_to_cached_source)
                .optional()
        })
    }

    pub fn get_source_by_path(&self, origin_path: &str) -> Result<Option<SourceRecord>, String> {
        let cached = self.with_cache_conn(|conn| {
            let sql = format!("SELECT {CACHE_SOURCE_COLUMNS} FROM sources WHERE origin_path = ?1");
            conn.query_row(&sql, params![origin_path], row_to_cached_source)
                .optional()
        })?;
        cached.map(|record| self.enrich_source(record)).transpose()
    }

    pub fn get_source_by_id(&self, id: i64) -> Result<Option<SourceRecord>, String> {
        self.get_cached_source_by_id(id)?
            .map(|record| self.enrich_source(record))
            .transpose()
    }

    pub fn upsert_source(&self, source: &UpsertSourceParams<'_>) -> Result<i64, String> {
        self.with_cache_conn(|conn| {
            conn.execute(
                "INSERT INTO sources (kind, origin_path, identity_segment, size_hint, content_hash, is_solid, entry_count, last_accessed)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, CURRENT_TIMESTAMP)
                 ON CONFLICT(origin_path) DO UPDATE SET
                    identity_segment = excluded.identity_segment,
                    size_hint = excluded.size_hint,
                    content_hash = excluded.content_hash,
                    is_solid = excluded.is_solid,
                    entry_count = excluded.entry_count,
                    last_accessed = CURRENT_TIMESTAMP",
                params![
                    source.kind,
                    source.origin_path,
                    source.identity_segment,
                    source.size_hint,
                    source.content_hash,
                    source.is_solid,
                    source.entry_count,
                ],
            )?;
            conn.query_row(
                "SELECT id FROM sources WHERE origin_path = ?1",
                params![source.origin_path],
                |row| row.get(0),
            )
        })
    }

    pub fn touch_source(&self, source_id: i64) -> Result<(), String> {
        self.with_cache_conn(|conn| {
            conn.execute(
                "UPDATE sources SET last_accessed = CURRENT_TIMESTAMP WHERE id = ?1",
                params![source_id],
            )?;
            Ok(())
        })
    }

    pub fn set_source_pinned(&self, source_id: i64, pinned: bool) -> Result<(), String> {
        let source = self
            .get_cached_source_by_id(source_id)?
            .ok_or_else(|| format!("Source {source_id} does not exist"))?;
        self.with_durable_conn(|conn| {
            conn.execute(
                "INSERT INTO source_preferences (origin_path, is_pinned, updated_at)
                 VALUES (?1, ?2, CURRENT_TIMESTAMP)
                 ON CONFLICT(origin_path) DO UPDATE SET
                    is_pinned = excluded.is_pinned,
                    updated_at = CURRENT_TIMESTAMP",
                params![source.origin_path, pinned],
            )?;
            conn.execute(
                "DELETE FROM source_preferences
                 WHERE origin_path = ?1 AND is_pinned = 0 AND policy_override IS NULL",
                params![source.origin_path],
            )?;
            Ok(())
        })
    }

    pub fn set_source_policy(
        &self,
        source_id: i64,
        policy_json: Option<&str>,
    ) -> Result<(), String> {
        let source = self
            .get_cached_source_by_id(source_id)?
            .ok_or_else(|| format!("Source {source_id} does not exist"))?;
        self.with_durable_conn(|conn| {
            conn.execute(
                "INSERT INTO source_preferences (origin_path, policy_override, updated_at)
                 VALUES (?1, ?2, CURRENT_TIMESTAMP)
                 ON CONFLICT(origin_path) DO UPDATE SET
                    policy_override = excluded.policy_override,
                    updated_at = CURRENT_TIMESTAMP",
                params![source.origin_path, policy_json],
            )?;
            conn.execute(
                "DELETE FROM source_preferences
                 WHERE origin_path = ?1 AND is_pinned = 0 AND policy_override IS NULL",
                params![source.origin_path],
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
        let source = self
            .get_cached_source_by_id(source_id)?
            .ok_or_else(|| format!("Source {source_id} does not exist"))?;
        let old_path = source.origin_path;
        if old_path == new_path {
            return self.with_cache_conn(|conn| {
                conn.execute(
                    "UPDATE sources SET content_hash = ?1, last_accessed = CURRENT_TIMESTAMP WHERE id = ?2",
                    params![new_hash, source_id],
                )?;
                Ok(())
            });
        }

        let preference = self.get_source_preference(&old_path)?;
        let secret_ref = self.get_archive_secret_ref(&old_path)?;
        let new_path_key = normalize_library_path_key(new_path);

        // Cross-database moves use copy -> cache update -> old-row cleanup.
        // If the cache update fails, both durable references remain valid and
        // a retry is safe; durable state is never stranded at the old path.
        self.with_durable_conn_mut(|conn| {
            let tx = conn.transaction()?;
            if preference.is_pinned || preference.policy_override.is_some() {
                tx.execute(
                    "INSERT INTO source_preferences (origin_path, is_pinned, policy_override, updated_at)
                     VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)
                     ON CONFLICT(origin_path) DO UPDATE SET
                        is_pinned = CASE
                            WHEN source_preferences.is_pinned = 1 OR excluded.is_pinned = 1 THEN 1
                            ELSE 0
                        END,
                        policy_override = COALESCE(excluded.policy_override, source_preferences.policy_override),
                        updated_at = CURRENT_TIMESTAMP",
                    params![new_path, preference.is_pinned, preference.policy_override],
                )?;
            }
            if let Some(vault_key) = &secret_ref {
                tx.execute(
                    "INSERT INTO archive_secret_refs (archive_path, vault_key, updated_at)
                     VALUES (?1, ?2, CURRENT_TIMESTAMP)
                     ON CONFLICT(archive_path) DO UPDATE SET
                        vault_key = excluded.vault_key,
                        updated_at = CURRENT_TIMESTAMP",
                    params![new_path, vault_key],
                )?;
            }
            tx.execute(
                "INSERT INTO library_sources (
                    kind, origin_path, path_key, display_name, is_favorite,
                    added_at, last_opened_at, last_scanned_at, image_count
                 )
                 SELECT
                    kind, ?1, ?2, display_name, is_favorite,
                    added_at, last_opened_at, last_scanned_at, image_count
                 FROM library_sources
                 WHERE origin_path = ?3
                 ON CONFLICT(path_key) DO UPDATE SET
                    origin_path = excluded.origin_path,
                    display_name = excluded.display_name,
                    is_favorite = CASE
                        WHEN library_sources.is_favorite = 1
                          OR excluded.is_favorite = 1 THEN 1
                        ELSE 0
                    END,
                    last_opened_at = COALESCE(
                        excluded.last_opened_at,
                        library_sources.last_opened_at
                    ),
                    last_scanned_at = COALESCE(
                        excluded.last_scanned_at,
                        library_sources.last_scanned_at
                    ),
                    image_count = COALESCE(
                        excluded.image_count,
                        library_sources.image_count
                    )",
                params![new_path, new_path_key, old_path],
            )?;
            tx.commit()
        })?;

        self.with_cache_conn(|conn| {
            conn.execute(
                "UPDATE sources
                 SET origin_path = ?1, content_hash = ?2, last_accessed = CURRENT_TIMESTAMP
                 WHERE id = ?3",
                params![new_path, new_hash, source_id],
            )?;
            Ok(())
        })?;

        self.with_durable_conn_mut(|conn| {
            let tx = conn.transaction()?;
            tx.execute(
                "DELETE FROM source_preferences WHERE origin_path = ?1",
                params![old_path],
            )?;
            if secret_ref.is_some() {
                tx.execute(
                    "DELETE FROM archive_secret_refs WHERE archive_path = ?1",
                    params![old_path],
                )?;
            }
            tx.execute(
                "DELETE FROM library_sources WHERE origin_path = ?1",
                params![old_path],
            )?;
            tx.commit()
        })
    }

    pub fn set_thumb_cache_size(&self, source_id: i64, bytes: i64) -> Result<(), String> {
        self.with_cache_conn(|conn| {
            conn.execute(
                "UPDATE sources SET thumb_cache_size = ?1 WHERE id = ?2",
                params![bytes, source_id],
            )?;
            Ok(())
        })
    }

    pub fn set_extracted_cache_size(&self, source_id: i64, bytes: i64) -> Result<(), String> {
        self.with_cache_conn(|conn| {
            conn.execute(
                "UPDATE sources SET extracted_cache_size = ?1 WHERE id = ?2",
                params![bytes, source_id],
            )?;
            Ok(())
        })
    }

    pub fn get_all_sources(&self) -> Result<Vec<SourceRecord>, String> {
        let cached = self.with_cache_conn(|conn| {
            let sql =
                format!("SELECT {CACHE_SOURCE_COLUMNS} FROM sources ORDER BY last_accessed DESC");
            let mut stmt = conn.prepare(&sql)?;
            let rows = stmt.query_map([], row_to_cached_source)?;
            rows.collect::<Result<Vec<_>, _>>()
        })?;
        self.enrich_sources(cached)
    }

    pub fn delete_source(&self, source_id: i64) -> Result<(), String> {
        self.with_cache_conn(|conn| {
            conn.execute("DELETE FROM sources WHERE id = ?1", params![source_id])?;
            Ok(())
        })
    }

    pub fn delete_all_sources(&self) -> Result<(), String> {
        self.with_cache_conn(|conn| {
            conn.execute("DELETE FROM sources", [])?;
            Ok(())
        })
    }

    pub fn delete_unpinned_sources(&self) -> Result<Vec<SourceRecord>, String> {
        let records: Vec<_> = self
            .get_all_sources()?
            .into_iter()
            .filter(|record| !record.is_pinned)
            .collect();
        self.with_cache_conn_mut(|conn| {
            let tx = conn.transaction()?;
            for record in &records {
                tx.execute("DELETE FROM sources WHERE id = ?1", params![record.id])?;
            }
            tx.commit()
        })?;
        Ok(records)
    }

    pub fn find_migration_candidates(
        &self,
        identity_segment: &str,
        size_hint: Option<i64>,
    ) -> Result<Vec<SourceRecord>, String> {
        let cached = self.with_cache_conn(|conn| match size_hint {
            Some(size) => {
                let sql = format!(
                    "SELECT {CACHE_SOURCE_COLUMNS} FROM sources
                     WHERE identity_segment = ?1 AND size_hint = ?2"
                );
                let mut stmt = conn.prepare(&sql)?;
                let rows = stmt.query_map(params![identity_segment, size], row_to_cached_source)?;
                rows.collect::<Result<Vec<_>, _>>()
            }
            None => {
                let sql = format!(
                    "SELECT {CACHE_SOURCE_COLUMNS} FROM sources
                     WHERE identity_segment = ?1 AND size_hint IS NULL"
                );
                let mut stmt = conn.prepare(&sql)?;
                let rows = stmt.query_map(params![identity_segment], row_to_cached_source)?;
                rows.collect::<Result<Vec<_>, _>>()
            }
        })?;
        self.enrich_sources(cached)
    }

    // ---- Disposable thumbnail operations ----

    pub fn insert_thumbnail(
        &self,
        source_id: i64,
        entry_path: &str,
        width: u32,
        height: u32,
        thumb_path: &str,
        file_size: i64,
    ) -> Result<(), String> {
        self.with_cache_conn(|conn| {
            conn.execute(
                "INSERT INTO thumbnails (source_id, entry_path, width, height, thumb_path, file_size)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(source_id, entry_path, width) DO UPDATE SET
                    height = excluded.height,
                    thumb_path = excluded.thumb_path,
                    file_size = excluded.file_size",
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
        self.with_cache_conn(|conn| {
            conn.query_row(
                "SELECT id, source_id, entry_path, width, height, thumb_path, file_size
                 FROM thumbnails WHERE source_id = ?1 AND entry_path = ?2 AND width = ?3",
                params![source_id, entry_path, width],
                row_to_thumb,
            )
            .optional()
        })
    }

    pub fn get_thumbnails_by_entry(
        &self,
        source_id: i64,
        entry_path: &str,
    ) -> Result<Vec<ThumbnailRecord>, String> {
        self.with_cache_conn(|conn| {
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
        self.with_cache_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, source_id, entry_path, width, height, thumb_path, file_size
                 FROM thumbnails WHERE source_id = ?1",
            )?;
            let rows = stmt.query_map(params![source_id], row_to_thumb)?;
            rows.collect::<Result<Vec<_>, _>>()
        })
    }

    pub fn delete_thumbnails_for_source(&self, source_id: i64) -> Result<(), String> {
        self.with_cache_conn(|conn| {
            conn.execute(
                "DELETE FROM thumbnails WHERE source_id = ?1",
                params![source_id],
            )?;
            Ok(())
        })
    }

    pub fn delete_all_thumbnails(&self) -> Result<(), String> {
        self.with_cache_conn(|conn| {
            conn.execute("DELETE FROM thumbnails", [])?;
            conn.execute("UPDATE sources SET thumb_cache_size = 0", [])?;
            Ok(())
        })
    }

    // ---- Disposable extracted-file operations ----

    pub fn insert_extracted(
        &self,
        source_id: i64,
        entry_path: &str,
        extract_path: &str,
        file_size: i64,
    ) -> Result<(), String> {
        self.with_cache_conn(|conn| {
            conn.execute(
                "INSERT INTO extracted (source_id, entry_path, extract_path, file_size, last_accessed)
                 VALUES (?1, ?2, ?3, ?4, CURRENT_TIMESTAMP)
                 ON CONFLICT(source_id, entry_path) DO UPDATE SET
                    extract_path = excluded.extract_path,
                    file_size = excluded.file_size,
                    last_accessed = CURRENT_TIMESTAMP",
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
        self.with_cache_conn(|conn| {
            conn.query_row(
                "SELECT id, source_id, entry_path, extract_path, file_size, last_accessed
                 FROM extracted WHERE source_id = ?1 AND entry_path = ?2",
                params![source_id, entry_path],
                row_to_extracted,
            )
            .optional()
        })
    }

    pub fn touch_extracted(&self, source_id: i64, entry_path: &str) -> Result<(), String> {
        self.with_cache_conn(|conn| {
            conn.execute(
                "UPDATE extracted SET last_accessed = CURRENT_TIMESTAMP
                 WHERE source_id = ?1 AND entry_path = ?2",
                params![source_id, entry_path],
            )?;
            Ok(())
        })
    }

    pub fn get_all_extracted_for_source(
        &self,
        source_id: i64,
    ) -> Result<Vec<ExtractedRecord>, String> {
        self.with_cache_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, source_id, entry_path, extract_path, file_size, last_accessed
                 FROM extracted WHERE source_id = ?1 ORDER BY last_accessed ASC",
            )?;
            let rows = stmt.query_map(params![source_id], row_to_extracted)?;
            rows.collect::<Result<Vec<_>, _>>()
        })
    }

    pub fn delete_extracted(&self, source_id: i64, entry_path: &str) -> Result<(), String> {
        self.with_cache_conn(|conn| {
            conn.execute(
                "DELETE FROM extracted WHERE source_id = ?1 AND entry_path = ?2",
                params![source_id, entry_path],
            )?;
            Ok(())
        })
    }

    pub fn delete_extracted_for_source(&self, source_id: i64) -> Result<(), String> {
        self.with_cache_conn(|conn| {
            conn.execute(
                "DELETE FROM extracted WHERE source_id = ?1",
                params![source_id],
            )?;
            Ok(())
        })
    }

    pub fn delete_all_extracted(&self) -> Result<(), String> {
        self.with_cache_conn(|conn| {
            conn.execute("DELETE FROM extracted", [])?;
            conn.execute("UPDATE sources SET extracted_cache_size = 0", [])?;
            Ok(())
        })
    }

    // ---- Durable references to secrets held by Stronghold ----

    pub fn get_archive_secret_ref(&self, archive_path: &str) -> Result<Option<String>, String> {
        self.with_durable_conn(|conn| {
            conn.query_row(
                "SELECT vault_key FROM archive_secret_refs WHERE archive_path = ?1",
                params![archive_path],
                |row| row.get(0),
            )
            .optional()
        })
    }

    pub fn save_archive_secret_ref(
        &self,
        archive_path: &str,
        vault_key: &str,
    ) -> Result<(), String> {
        self.with_durable_conn(|conn| {
            conn.execute(
                "INSERT INTO archive_secret_refs (archive_path, vault_key, updated_at)
                 VALUES (?1, ?2, CURRENT_TIMESTAMP)
                 ON CONFLICT(archive_path) DO UPDATE SET
                    vault_key = excluded.vault_key,
                    updated_at = CURRENT_TIMESTAMP",
                params![archive_path, vault_key],
            )?;
            Ok(())
        })
    }

    pub fn delete_archive_secret_ref(&self, archive_path: &str) -> Result<(), String> {
        self.with_durable_conn(|conn| {
            conn.execute(
                "DELETE FROM archive_secret_refs WHERE archive_path = ?1",
                params![archive_path],
            )?;
            Ok(())
        })
    }

    pub fn delete_all_archive_secret_refs(&self) -> Result<(), String> {
        self.with_durable_conn(|conn| {
            conn.execute("DELETE FROM archive_secret_refs", [])?;
            Ok(())
        })
    }
}

#[derive(Debug, Clone, Default)]
struct SourcePreference {
    is_pinned: bool,
    policy_override: Option<String>,
}

#[derive(Debug, Clone)]
struct CachedSourceRecord {
    id: i64,
    kind: String,
    origin_path: String,
    identity_segment: String,
    size_hint: Option<i64>,
    content_hash: String,
    is_solid: bool,
    entry_count: Option<i64>,
    thumb_cache_size: i64,
    extracted_cache_size: i64,
    last_accessed: Option<String>,
}

impl CachedSourceRecord {
    fn with_preference(self, preference: SourcePreference) -> SourceRecord {
        SourceRecord {
            id: self.id,
            kind: self.kind,
            origin_path: self.origin_path,
            identity_segment: self.identity_segment,
            size_hint: self.size_hint,
            content_hash: self.content_hash,
            is_solid: self.is_solid,
            is_pinned: preference.is_pinned,
            entry_count: self.entry_count,
            thumb_cache_size: self.thumb_cache_size,
            extracted_cache_size: self.extracted_cache_size,
            policy_override: preference.policy_override,
            last_accessed: self.last_accessed,
        }
    }
}

fn row_to_library_source(row: &rusqlite::Row<'_>) -> rusqlite::Result<LibrarySourceRecord> {
    Ok(LibrarySourceRecord {
        id: row.get(0)?,
        kind: row.get(1)?,
        origin_path: row.get(2)?,
        display_name: row.get(3)?,
        is_favorite: row.get::<_, i64>(4)? != 0,
        added_at: row.get(5)?,
        last_opened_at: row.get(6)?,
        last_scanned_at: row.get(7)?,
        image_count: row.get(8)?,
    })
}

fn row_to_cached_source(row: &rusqlite::Row<'_>) -> rusqlite::Result<CachedSourceRecord> {
    Ok(CachedSourceRecord {
        id: row.get(0)?,
        kind: row.get(1)?,
        origin_path: row.get(2)?,
        identity_segment: row.get(3)?,
        size_hint: row.get(4)?,
        content_hash: row.get(5)?,
        is_solid: row.get::<_, i64>(6)? != 0,
        entry_count: row.get(7)?,
        thumb_cache_size: row.get(8)?,
        extracted_cache_size: row.get(9)?,
        last_accessed: row.get(10)?,
    })
}

fn row_to_thumb(row: &rusqlite::Row<'_>) -> rusqlite::Result<ThumbnailRecord> {
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

fn row_to_selection_entry(row: &rusqlite::Row<'_>) -> rusqlite::Result<SelectionEntryRecord> {
    Ok(SelectionEntryRecord {
        package_key: row.get(0)?,
        entry_key: row.get(1)?,
        locator: row.get(2)?,
        relative_path: row.get(3)?,
        selected_at: row.get(4)?,
        last_seen_at: row.get(5)?,
    })
}

fn upsert_selection_entries_in_tx(
    tx: &rusqlite::Transaction<'_>,
    entries: &[SelectionEntryRecord],
) -> rusqlite::Result<()> {
    for entry in entries {
        tx.execute(
            "INSERT INTO selection_entries (
                package_key, entry_key, locator, relative_path, selected_at, last_seen_at
             )
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(package_key, entry_key) DO UPDATE SET
                locator = excluded.locator,
                relative_path = excluded.relative_path,
                selected_at = excluded.selected_at,
                last_seen_at = excluded.last_seen_at",
            params![
                entry.package_key,
                entry.entry_key,
                entry.locator,
                entry.relative_path,
                entry.selected_at,
                entry.last_seen_at,
            ],
        )?;
    }
    Ok(())
}

fn remove_selection_entries_in_tx(
    tx: &rusqlite::Transaction<'_>,
    keys: &[(String, String)],
) -> rusqlite::Result<()> {
    for (package_key, entry_key) in keys {
        tx.execute(
            "DELETE FROM selection_entries WHERE package_key = ?1 AND entry_key = ?2",
            params![package_key, entry_key],
        )?;
    }
    Ok(())
}

fn row_to_extracted(row: &rusqlite::Row<'_>) -> rusqlite::Result<ExtractedRecord> {
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
pub struct SelectionEntryRecord {
    pub package_key: String,
    pub entry_key: String,
    pub locator: String,
    pub relative_path: String,
    pub selected_at: String,
    pub last_seen_at: Option<String>,
}

#[derive(Debug, Clone)]
pub struct UpsertLibrarySourceParams<'a> {
    pub kind: &'a str,
    pub origin_path: &'a str,
    pub path_key: &'a str,
    pub display_name: &'a str,
    pub last_opened_at: Option<&'a str>,
}

#[derive(Debug, Clone)]
pub struct LibrarySourceRecord {
    pub id: i64,
    pub kind: String,
    pub origin_path: String,
    pub display_name: String,
    pub is_favorite: bool,
    pub added_at: String,
    pub last_opened_at: Option<String>,
    pub last_scanned_at: Option<String>,
    pub image_count: Option<i64>,
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

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn new_db() -> (Database, tempfile::TempDir) {
        let root = tempdir().unwrap();
        let db = Database::new(&root.path().join("data"), &root.path().join("cache")).unwrap();
        (db, root)
    }

    fn source<'a>(path: &'a str, hash: &'a str) -> UpsertSourceParams<'a> {
        UpsertSourceParams {
            kind: "archive",
            origin_path: path,
            identity_segment: "pack.zip",
            size_hint: Some(123),
            content_hash: hash,
            is_solid: false,
            entry_count: Some(4),
        }
    }

    #[test]
    fn creates_versioned_durable_and_cache_schemas() {
        let (db, _root) = new_db();
        let durable_version: i64 = db
            .with_durable_conn(|conn| conn.query_row("PRAGMA user_version", [], |row| row.get(0)))
            .unwrap();
        let cache_version: i64 = db
            .with_cache_conn(|conn| conn.query_row("PRAGMA user_version", [], |row| row.get(0)))
            .unwrap();
        assert_eq!(durable_version, DURABLE_SCHEMA_VERSION as i64);
        assert_eq!(cache_version, CACHE_SCHEMA_VERSION as i64);
    }

    #[test]
    fn upsert_and_get_source() {
        let (db, _root) = new_db();
        let id = db.upsert_source(&source("D:/packs/a.zip", "h1")).unwrap();
        let record = db.get_source_by_id(id).unwrap().unwrap();
        assert_eq!(record.kind, "archive");
        assert_eq!(record.identity_segment, "pack.zip");
        assert_eq!(record.size_hint, Some(123));
        assert_eq!(
            db.get_source_by_path("D:/packs/a.zip").unwrap().unwrap().id,
            id
        );
    }

    #[test]
    fn source_preferences_are_durable() {
        let (db, root) = new_db();
        let path = "D:/packs/preferred.zip";
        let id = db.upsert_source(&source(path, "h1")).unwrap();
        db.set_source_pinned(id, true).unwrap();
        db.set_source_policy(id, Some(r#"{"extracted":{"mode":"no-cache"}}"#))
            .unwrap();
        db.save_settings_document(1, r#"{"version":1,"settings":{}}"#)
            .unwrap();
        db.save_archive_secret_ref(path, "vault-key").unwrap();
        drop(db);

        let cache_dir = root.path().join("cache");
        Database::reset_cache_storage(&cache_dir, &cache_dir.join("cache.db")).unwrap();
        let reopened = Database::new(&root.path().join("data"), &cache_dir).unwrap();
        assert!(reopened.get_all_sources().unwrap().is_empty());

        let new_id = reopened.upsert_source(&source(path, "h2")).unwrap();
        let record = reopened.get_source_by_id(new_id).unwrap().unwrap();
        assert!(record.is_pinned);
        assert!(record.policy_override.is_some());
        assert!(reopened.load_settings_document().unwrap().is_some());
        assert_eq!(
            reopened.get_archive_secret_ref(path).unwrap().as_deref(),
            Some("vault-key")
        );
    }

    #[test]
    fn gallery_library_survives_cache_rebuild() {
        let (db, root) = new_db();
        let path = "D:/photos";
        let path_key = normalize_library_path_key(path);
        db.upsert_library_sources(&[UpsertLibrarySourceParams {
            kind: "folder",
            origin_path: path,
            path_key: &path_key,
            display_name: "Photography",
            last_opened_at: Some("2026-08-30T10:00:00Z"),
        }])
        .unwrap();
        let id = db.get_library_sources().unwrap()[0].id;
        db.update_library_source(id, None, Some(true)).unwrap();
        db.mark_library_sources_scanned(&[path_key], Some(42))
            .unwrap();
        drop(db);

        let cache_dir = root.path().join("cache");
        Database::reset_cache_storage(&cache_dir, &cache_dir.join("cache.db")).unwrap();
        let reopened = Database::new(&root.path().join("data"), &cache_dir).unwrap();
        let sources = reopened.get_library_sources().unwrap();

        assert_eq!(sources.len(), 1);
        assert_eq!(sources[0].display_name, "Photography");
        assert!(sources[0].is_favorite);
        assert_eq!(sources[0].image_count, Some(42));
        assert!(sources[0].last_scanned_at.is_some());
    }

    #[test]
    fn unknown_cache_schema_is_rebuilt() {
        let root = tempdir().unwrap();
        let cache_dir = root.path().join("cache");
        fs::create_dir_all(&cache_dir).unwrap();
        let conn = Connection::open(cache_dir.join("cache.db")).unwrap();
        conn.execute_batch("CREATE TABLE obsolete(value TEXT); PRAGMA user_version = 99;")
            .unwrap();
        drop(conn);

        let db = Database::new(&root.path().join("data"), &cache_dir).unwrap();
        let obsolete_exists: i64 = db
            .with_cache_conn(|conn| {
                conn.query_row(
                    "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'obsolete'",
                    [],
                    |row| row.get(0),
                )
            })
            .unwrap();
        assert_eq!(obsolete_exists, 0);
    }

    #[test]
    fn durable_database_ahead_is_preserved() {
        let root = tempdir().unwrap();
        let data_dir = root.path().join("data");
        let cache_dir = root.path().join("cache");
        fs::create_dir_all(&data_dir).unwrap();
        let conn = Connection::open(data_dir.join("library.db")).unwrap();
        conn.execute_batch("CREATE TABLE sentinel(value TEXT); PRAGMA user_version = 99;")
            .unwrap();
        conn.execute("INSERT INTO sentinel(value) VALUES ('keep-me')", [])
            .unwrap();
        drop(conn);

        assert!(Database::new(&data_dir, &cache_dir).is_err());
        let conn = Connection::open(data_dir.join("library.db")).unwrap();
        let value: String = conn
            .query_row("SELECT value FROM sentinel", [], |row| row.get(0))
            .unwrap();
        assert_eq!(value, "keep-me");
    }

    #[test]
    fn thumbnail_multi_width() {
        let (db, _root) = new_db();
        let id = db.upsert_source(&source("D:/a.zip", "h")).unwrap();
        db.insert_thumbnail(id, "a/b.jpg", 400, 300, "thumbs/h/x_400.webp", 10)
            .unwrap();
        db.insert_thumbnail(id, "a/b.jpg", 800, 600, "thumbs/h/x_800.webp", 20)
            .unwrap();
        let all = db.get_thumbnails_by_entry(id, "a/b.jpg").unwrap();
        assert_eq!(all.len(), 2);
        assert_eq!(all[0].width, 400);
        assert_eq!(all[1].width, 800);
    }

    #[test]
    fn extracted_crud_and_cascading_delete() {
        let (db, _root) = new_db();
        let id = db.upsert_source(&source("D:/e.zip", "h")).unwrap();
        db.insert_thumbnail(id, "e/x.jpg", 400, 300, "thumb", 10)
            .unwrap();
        db.insert_extracted(id, "e/x.jpg", "extracted/h/x.jpg", 1024)
            .unwrap();
        assert_eq!(
            db.get_extracted(id, "e/x.jpg").unwrap().unwrap().file_size,
            1024
        );
        db.delete_source(id).unwrap();
        assert!(db.get_thumbnail(id, "e/x.jpg", 400).unwrap().is_none());
        assert!(db.get_extracted(id, "e/x.jpg").unwrap().is_none());
    }

    #[test]
    fn delete_unpinned_sources_respects_durable_preference() {
        let (db, _root) = new_db();
        let pinned = db.upsert_source(&source("D:/pinned.zip", "p")).unwrap();
        let unpinned = db.upsert_source(&source("D:/temp.zip", "t")).unwrap();
        db.set_source_pinned(pinned, true).unwrap();

        let deleted = db.delete_unpinned_sources().unwrap();
        assert_eq!(deleted.len(), 1);
        assert_eq!(deleted[0].id, unpinned);
        assert!(db.get_source_by_id(pinned).unwrap().is_some());
    }

    #[test]
    fn path_migration_moves_preferences_and_secret_references() {
        let (db, _root) = new_db();
        let old_path = "D:/old/pack.zip";
        let new_path = "E:/new/pack.zip";
        let id = db.upsert_source(&source(old_path, "old-hash")).unwrap();
        let old_path_key = normalize_library_path_key(old_path);
        db.upsert_library_sources(&[UpsertLibrarySourceParams {
            kind: "archive",
            origin_path: old_path,
            path_key: &old_path_key,
            display_name: "Pack",
            last_opened_at: None,
        }])
        .unwrap();
        db.set_source_pinned(id, true).unwrap();
        db.save_archive_secret_ref(old_path, "stable-vault-key")
            .unwrap();

        db.update_source_path(id, new_path, "new-hash").unwrap();
        let record = db.get_source_by_path(new_path).unwrap().unwrap();
        assert!(record.is_pinned);
        assert_eq!(record.content_hash, "new-hash");
        assert!(db.get_archive_secret_ref(old_path).unwrap().is_none());
        assert_eq!(
            db.get_archive_secret_ref(new_path).unwrap().as_deref(),
            Some("stable-vault-key")
        );
        let library = db.get_library_sources().unwrap();
        assert_eq!(library.len(), 1);
        assert_eq!(library[0].origin_path, new_path);
    }

    fn sample_selection(path: &str) -> SelectionEntryRecord {
        SelectionEntryRecord {
            package_key: normalize_library_path_key("D:/photos"),
            entry_key: normalize_library_path_key(path),
            locator: path.to_string(),
            relative_path: "a.jpg".to_string(),
            selected_at: "2026-08-31T10:00:00.000Z".to_string(),
            last_seen_at: Some("2026-08-31T10:00:00.000Z".to_string()),
        }
    }

    #[test]
    fn selection_state_survives_reopen_and_cache_rebuild() {
        let (db, root) = new_db();
        db.save_selection_mode(true).unwrap();
        db.upsert_selection_entries(&[sample_selection("D:/photos/a.jpg")])
            .unwrap();
        drop(db);

        let cache_dir = root.path().join("cache");
        Database::reset_cache_storage(&cache_dir, &cache_dir.join("cache.db")).unwrap();
        let reopened = Database::new(&root.path().join("data"), &cache_dir).unwrap();
        let (mode, entries) = reopened.load_selection_state().unwrap();
        assert!(mode);
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].locator, "D:/photos/a.jpg");
    }

    #[test]
    fn selection_replace_is_transactional() {
        let (db, _root) = new_db();
        db.upsert_selection_entries(&[sample_selection("D:/photos/a.jpg")])
            .unwrap();
        let old_key = (
            normalize_library_path_key("D:/photos"),
            normalize_library_path_key("D:/photos/a.jpg"),
        );
        let moved = SelectionEntryRecord {
            package_key: normalize_library_path_key("D:/sorted"),
            entry_key: normalize_library_path_key("D:/sorted/a.jpg"),
            locator: "D:/sorted/a.jpg".to_string(),
            relative_path: "a.jpg".to_string(),
            selected_at: "2026-08-31T10:00:00.000Z".to_string(),
            last_seen_at: Some("2026-08-31T11:00:00.000Z".to_string()),
        };
        db.replace_selection_entries(&[old_key], &[moved]).unwrap();
        let (_, entries) = db.load_selection_state().unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].locator, "D:/sorted/a.jpg");
    }

    #[test]
    fn clearing_cache_does_not_drop_selection() {
        let (db, root) = new_db();
        db.upsert_selection_entries(&[sample_selection("D:/photos/a.jpg")])
            .unwrap();
        let cache_dir = root.path().join("cache");
        drop(db);
        Database::reset_cache_storage(&cache_dir, &cache_dir.join("cache.db")).unwrap();
        let reopened = Database::new(&root.path().join("data"), &cache_dir).unwrap();
        let (_, entries) = reopened.load_selection_state().unwrap();
        assert_eq!(entries.len(), 1);
    }
}
