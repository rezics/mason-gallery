use crate::archive::{self, open_archive, parse_archive_uri, ArchiveEntry, ArchiveError};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Default)]
pub struct ArchiveService;

impl ArchiveService {
    pub fn new() -> Self {
        Self
    }

    pub fn list_entries(
        &self,
        archive_path: &str,
        password: Option<&str>,
    ) -> Result<(Vec<ArchiveEntry>, bool, bool), String> {
        let reader = open_archive(Path::new(archive_path)).map_err(|e| format!("{}", e))?;
        let entries = reader
            .list_entries(password)
            .map_err(|e| format!("{}", e))?;
        let is_solid = reader.is_solid().unwrap_or(false);
        let is_encrypted = reader.is_encrypted().unwrap_or(false);
        Ok((entries, is_solid, is_encrypted))
    }

    /// Extract to the given output path (creates parent dirs as needed).
    pub fn extract_to_path(
        &self,
        archive_path: &str,
        entry_path: &str,
        output_path: &Path,
        password: Option<&str>,
    ) -> Result<(), String> {
        let reader = open_archive(Path::new(archive_path)).map_err(|e| format!("{}", e))?;
        reader
            .extract_entry(entry_path, output_path, password)
            .map_err(|e| format!("{}", e))
    }

    pub fn extract_to_memory(
        &self,
        archive_path: &str,
        entry_path: &str,
        password: Option<&str>,
    ) -> Result<Vec<u8>, String> {
        let reader = open_archive(Path::new(archive_path)).map_err(|e| format!("{}", e))?;
        reader
            .extract_entry_to_memory(entry_path, password)
            .map_err(|e| format!("{}", e))
    }

    pub fn parse_uri(uri: &str) -> Result<(String, String), ArchiveError> {
        parse_archive_uri(uri)
    }

    pub fn is_archive_ext(ext: &str) -> bool {
        archive::is_archive_extension(ext)
    }
}

/// Result of resolving an archive entry to a servable file.
pub enum ExtractResult {
    /// Previously cached file — already on disk.
    Cached(PathBuf),
    /// Freshly extracted and persisted to the extracted cache.
    FreshPersisted(PathBuf),
    /// Extracted to a tempfile that must be deleted after response completes
    /// (no-cache mode or below minFileSize threshold).
    Tempfile(tempfile::TempPath),
}

impl ExtractResult {
    pub fn path(&self) -> &Path {
        match self {
            ExtractResult::Cached(p) => p,
            ExtractResult::FreshPersisted(p) => p,
            ExtractResult::Tempfile(p) => p.as_ref(),
        }
    }
}

pub fn entry_extension(entry_path: &str) -> String {
    Path::new(entry_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("bin")
        .to_string()
}

pub fn extracted_target_path(
    cache_dir: &Path,
    source_hash: &str,
    entry_hash: &str,
    ext: &str,
) -> PathBuf {
    cache_dir
        .join("extracted")
        .join(source_hash)
        .join(format!("{}.{}", entry_hash, ext))
}

pub fn ensure_parent_dir(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create dir {}: {}", parent.display(), e))?;
    }
    Ok(())
}
