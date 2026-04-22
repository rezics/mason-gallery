use crate::archive::compute_entry_hash;
use crate::database::Database;
use crate::password::PasswordCache;
use crate::server::AllowedRoots;
use crate::services::archive_service::{
    ensure_parent_dir, entry_extension, extracted_target_path, ArchiveService, ExtractResult,
};
use crate::services::policy::{CachePolicy, ExtractedMode};
use crate::services::source_service::SourceService;
use crate::services::{acquire_entry_lock, ExtractLocks};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

pub struct ImageService {
    db: Arc<Database>,
    archive_svc: Arc<ArchiveService>,
    source_svc: Arc<SourceService>,
    password_cache: Arc<PasswordCache>,
    extract_locks: ExtractLocks,
    cache_dir: PathBuf,
    allowed_roots: AllowedRoots,
}

impl ImageService {
    pub fn new(
        db: Arc<Database>,
        archive_svc: Arc<ArchiveService>,
        source_svc: Arc<SourceService>,
        password_cache: Arc<PasswordCache>,
        extract_locks: ExtractLocks,
        cache_dir: PathBuf,
        allowed_roots: AllowedRoots,
    ) -> Self {
        Self {
            db,
            archive_svc,
            source_svc,
            password_cache,
            extract_locks,
            cache_dir,
            allowed_roots,
        }
    }

    /// Resolve an image URI to bytes backed by a file on disk.
    ///
    /// Routing:
    /// - `archive:///<path>#<entry>` → extract via `archive_service`, honor policy
    /// - `file://<path>` or bare path → canonicalize, verify allowed-root, return as-is
    pub async fn resolve_original(
        &self,
        uri: &str,
        policy: &CachePolicy,
    ) -> Result<ExtractResult, String> {
        if let Some(rest) = uri.strip_prefix("archive:///") {
            return self.resolve_archive_entry(rest, policy).await;
        }

        let raw = uri.strip_prefix("file://").unwrap_or(uri);
        self.resolve_filesystem_path(raw)
    }

    fn resolve_filesystem_path(&self, raw: &str) -> Result<ExtractResult, String> {
        let requested = PathBuf::from(raw);
        let canonical = fs::canonicalize(&requested)
            .map_err(|e| format!("Failed to canonicalize path: {}", e))?;

        let allowed = {
            let roots = self
                .allowed_roots
                .read()
                .map_err(|e| format!("allowed_roots lock: {}", e))?;
            roots.iter().any(|root| canonical.starts_with(root))
        };
        if !allowed {
            return Err("Forbidden: path outside allowed roots".to_string());
        }

        Ok(ExtractResult::Cached(canonical))
    }

    async fn resolve_archive_entry(
        &self,
        rest: &str,
        policy: &CachePolicy,
    ) -> Result<ExtractResult, String> {
        let (archive_path, entry_path) = rest
            .split_once('#')
            .ok_or_else(|| "Missing '#' separator in archive URI".to_string())?;

        let (source, _size) = self
            .source_svc
            .open_or_create_archive(archive_path, None, None)?;
        let source_hash = source.content_hash.clone();
        let source_id = source.id;
        let entry_hash = compute_entry_hash(entry_path);

        // Fast path: cached extraction still on disk.
        if let Some(rec) = self.db.get_extracted(source_id, entry_path)? {
            let p = PathBuf::from(&rec.extract_path);
            if p.exists() {
                let _ = self.db.touch_extracted(source_id, entry_path);
                return Ok(ExtractResult::Cached(p));
            }
            // Stale DB row — drop it and fall through to re-extract.
            let _ = self.db.delete_extracted(source_id, entry_path);
        }

        let _guard = acquire_entry_lock(&self.extract_locks, &source_hash, &entry_hash).await;

        // Re-check after lock acquisition in case another task extracted it.
        if let Some(rec) = self.db.get_extracted(source_id, entry_path)? {
            let p = PathBuf::from(&rec.extract_path);
            if p.exists() {
                let _ = self.db.touch_extracted(source_id, entry_path);
                return Ok(ExtractResult::Cached(p));
            }
        }

        let password = self.password_cache.get(archive_path);
        let data = self.archive_svc.extract_to_memory(
            archive_path,
            entry_path,
            password.as_deref(),
        )?;
        let byte_len = data.len() as i64;

        let ext = entry_extension(entry_path);
        let below_min = policy
            .extracted
            .min_file_size
            .map(|m| byte_len < m)
            .unwrap_or(false);

        let use_tempfile = matches!(policy.extracted.mode, ExtractedMode::NoCache) || below_min;
        if use_tempfile {
            let temp = tempfile::Builder::new()
                .prefix("mg-img-")
                .suffix(&format!(".{}", ext))
                .tempfile()
                .map_err(|e| format!("Failed to create tempfile: {}", e))?;
            fs::write(temp.path(), &data)
                .map_err(|e| format!("Failed to write tempfile: {}", e))?;
            return Ok(ExtractResult::Tempfile(temp.into_temp_path()));
        }

        let target = extracted_target_path(&self.cache_dir, &source_hash, &entry_hash, &ext);
        ensure_parent_dir(&target)?;
        fs::write(&target, &data)
            .map_err(|e| format!("Failed to write extracted file: {}", e))?;

        let target_str = target.to_string_lossy().to_string();
        self.db
            .insert_extracted(source_id, entry_path, &target_str, byte_len)?;

        if matches!(policy.extracted.mode, ExtractedMode::LruCapped) {
            if let Some(max) = policy.extracted.max_size_per_source {
                self.enforce_lru_cap(source_id, max)?;
            }
        }
        self.refresh_extracted_size(source_id)?;

        Ok(ExtractResult::FreshPersisted(target))
    }

    fn enforce_lru_cap(&self, source_id: i64, max_bytes: i64) -> Result<(), String> {
        let mut rows = self.db.get_all_extracted_for_source(source_id)?;
        let mut total: i64 = rows.iter().map(|r| r.file_size).sum();
        // Oldest first (query orders by last_accessed ASC).
        while total > max_bytes {
            let Some(oldest) = rows.first().cloned() else {
                break;
            };
            let p = PathBuf::from(&oldest.extract_path);
            let _ = fs::remove_file(&p);
            self.db.delete_extracted(source_id, &oldest.entry_path)?;
            total -= oldest.file_size;
            rows.remove(0);
        }
        Ok(())
    }

    fn refresh_extracted_size(&self, source_id: i64) -> Result<(), String> {
        let total: i64 = self
            .db
            .get_all_extracted_for_source(source_id)?
            .iter()
            .map(|r| r.file_size)
            .sum();
        self.db.set_extracted_cache_size(source_id, total)
    }

    pub fn clear_for_source(&self, source_id: i64, source_hash: &str) -> Result<(), String> {
        let dir = self.cache_dir.join("extracted").join(source_hash);
        let _ = fs::remove_dir_all(&dir);
        self.db.delete_extracted_for_source(source_id)?;
        self.db.set_extracted_cache_size(source_id, 0)?;
        Ok(())
    }

    pub fn clear_all(&self) -> Result<(), String> {
        let _ = fs::remove_dir_all(self.cache_dir.join("extracted"));
        self.db.delete_all_extracted()
    }

    pub fn extracted_root(&self) -> PathBuf {
        self.cache_dir.join("extracted")
    }

    pub fn cache_dir(&self) -> &Path {
        &self.cache_dir
    }
}
