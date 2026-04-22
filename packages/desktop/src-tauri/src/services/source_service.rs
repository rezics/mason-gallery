use crate::archive::compute_archive_hash;
use crate::database::{Database, SourceRecord, UpsertSourceParams};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::Path;
use std::sync::Arc;
use std::time::UNIX_EPOCH;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SourceKind {
    Archive,
    Folder,
}

impl SourceKind {
    pub fn as_str(self) -> &'static str {
        match self {
            SourceKind::Archive => "archive",
            SourceKind::Folder => "folder",
        }
    }
}

#[derive(Debug, Clone)]
pub struct SourceMigrationCandidate {
    pub source_id: i64,
    pub old_path: String,
    pub kind: String,
    pub match_score: usize,
}

pub struct SourceService {
    db: Arc<Database>,
}

impl SourceService {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }

    /// Identity segment is the final path segment (filename for archives,
    /// directory name for folders). Used for migration-candidate lookups.
    pub fn identity_segment(path: &str) -> String {
        let normalized = path.replace('\\', "/");
        let trimmed = normalized.trim_end_matches('/');
        match trimmed.rsplit_once('/') {
            Some((_, last)) if !last.is_empty() => last.to_string(),
            _ => trimmed.to_string(),
        }
    }

    pub fn folder_hash(origin_path: &str) -> String {
        let normalized = origin_path.replace('\\', "/");
        let trimmed = normalized.trim_end_matches('/');
        let mut hasher = DefaultHasher::new();
        "folder".hash(&mut hasher);
        trimmed.hash(&mut hasher);
        format!("{:016x}", hasher.finish())
    }

    pub fn archive_metadata(path: &str) -> Result<(u64, u64), String> {
        let meta = std::fs::metadata(path)
            .map_err(|e| format!("Failed to read file metadata: {}", e))?;
        let size = meta.len();
        let mtime = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);
        Ok((size, mtime))
    }

    pub fn open_or_create_archive(
        &self,
        path: &str,
        is_solid: Option<bool>,
        entry_count: Option<i64>,
    ) -> Result<(SourceRecord, i64), String> {
        let (size, mtime) = Self::archive_metadata(path)?;
        let hash = compute_archive_hash(path, size, mtime);
        let identity = Self::identity_segment(path);

        let id = self.db.upsert_source(&UpsertSourceParams {
            kind: "archive",
            origin_path: path,
            identity_segment: &identity,
            size_hint: Some(size as i64),
            content_hash: &hash,
            is_solid: is_solid.unwrap_or(false),
            entry_count,
        })?;
        let rec = self
            .db
            .get_source_by_id(id)?
            .ok_or_else(|| "Failed to re-fetch source after upsert".to_string())?;
        Ok((rec, size as i64))
    }

    pub fn open_or_create_folder(
        &self,
        path: &str,
        entry_count: Option<i64>,
    ) -> Result<SourceRecord, String> {
        let identity = Self::identity_segment(path);
        let hash = Self::folder_hash(path);
        let id = self.db.upsert_source(&UpsertSourceParams {
            kind: "folder",
            origin_path: path,
            identity_segment: &identity,
            size_hint: None,
            content_hash: &hash,
            is_solid: false,
            entry_count,
        })?;
        self.db
            .get_source_by_id(id)?
            .ok_or_else(|| "Failed to re-fetch folder source".to_string())
    }

    /// Returns migration candidate (if any) via identity-segment plus
    /// reverse-path-segment scoring. Skips exact-path matches (not migrations).
    pub fn find_migration_candidate(
        &self,
        new_path: &str,
        kind: SourceKind,
    ) -> Result<Option<SourceMigrationCandidate>, String> {
        if self.db.get_source_by_path(new_path)?.is_some() {
            return Ok(None);
        }

        let identity = Self::identity_segment(new_path);
        let size_hint = if matches!(kind, SourceKind::Archive) {
            let (size, _) = Self::archive_metadata(new_path)?;
            Some(size as i64)
        } else {
            None
        };

        let candidates = self.db.find_migration_candidates(&identity, size_hint)?;
        if candidates.is_empty() {
            return Ok(None);
        }

        let normalized_new = new_path.replace('\\', "/");
        let new_segments: Vec<&str> = normalized_new.split('/').rev().collect();

        let mut best: Option<SourceMigrationCandidate> = None;
        for cand in &candidates {
            if cand.origin_path == new_path {
                continue;
            }
            let old_normalized = cand.origin_path.replace('\\', "/");
            let old_segments: Vec<&str> = old_normalized.split('/').rev().collect();

            let mut score = 0;
            for (a, b) in new_segments.iter().zip(old_segments.iter()) {
                if a == b {
                    score += 1;
                } else {
                    break;
                }
            }
            if score >= 1
                && (best.is_none() || score > best.as_ref().unwrap().match_score)
            {
                best = Some(SourceMigrationCandidate {
                    source_id: cand.id,
                    old_path: cand.origin_path.clone(),
                    kind: cand.kind.clone(),
                    match_score: score,
                });
            }
        }
        Ok(best)
    }

    pub fn confirm_migration(
        &self,
        source_id: i64,
        new_path: &str,
    ) -> Result<(), String> {
        let rec = self
            .db
            .get_source_by_id(source_id)?
            .ok_or_else(|| "Source not found".to_string())?;

        let new_hash = if rec.kind == "archive" {
            let (size, mtime) = Self::archive_metadata(new_path)?;
            compute_archive_hash(new_path, size, mtime)
        } else {
            Self::folder_hash(new_path)
        };
        self.db.update_source_path(source_id, new_path, &new_hash)
    }

    pub fn db(&self) -> &Arc<Database> {
        &self.db
    }
}

pub fn path_exists<P: AsRef<Path>>(p: P) -> bool {
    p.as_ref().exists()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn identity_segment_archive() {
        assert_eq!(SourceService::identity_segment("D:/a/b/pack.zip"), "pack.zip");
        assert_eq!(SourceService::identity_segment("D:\\a\\b\\pack.zip"), "pack.zip");
    }

    #[test]
    fn identity_segment_folder_trailing_slash() {
        assert_eq!(
            SourceService::identity_segment("D:/photos/collection/"),
            "collection"
        );
    }

    #[test]
    fn folder_hash_stable() {
        let a = SourceService::folder_hash("D:/photos/collection");
        let b = SourceService::folder_hash("D:/photos/collection/");
        let c = SourceService::folder_hash("D:\\photos\\collection");
        assert_eq!(a, b);
        assert_eq!(a, c);
    }
}
