use crate::archive::{
    self, compute_archive_hash, compute_entry_hash, is_archive_extension, open_archive,
    parse_archive_uri, ArchiveError,
};
use crate::commands::{ImageBatch, ImageCount, WImage};
use crate::database::Database;
use crate::password::PasswordCache;
use crate::CacheDir;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanArchiveParams {
    pub path: String,
    pub formats: Vec<String>,
    pub page_size: usize,
    pub sort_method: String,
    pub password: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveInfoResponse {
    pub format: String,
    pub entry_count: usize,
    pub total_size: u64,
    pub is_solid: bool,
    pub is_encrypted: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheStatsResponse {
    pub id: i64,
    pub archive_path: String,
    pub filename: String,
    pub entry_count: Option<i64>,
    pub cache_size: i64,
    pub is_pinned: bool,
    pub last_accessed: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrationCandidate {
    pub archive_id: i64,
    pub old_path: String,
    pub match_score: usize,
}

fn get_file_metadata(path: &str) -> Result<(u64, u64), String> {
    let metadata = fs::metadata(path).map_err(|e| format!("Failed to read file metadata: {}", e))?;
    let file_size = metadata.len();
    let mtime = metadata
        .modified()
        .map_err(|e| format!("Failed to get mtime: {}", e))?
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    Ok((file_size, mtime))
}

fn get_password_for_archive(
    app: &AppHandle,
    archive_path: &str,
    explicit_password: Option<&str>,
) -> Option<String> {
    // Priority: explicit > in-memory > persisted
    if let Some(pw) = explicit_password {
        return Some(pw.to_string());
    }

    let pw_cache = app.state::<PasswordCache>();
    if let Some(pw) = pw_cache.get(archive_path) {
        return Some(pw);
    }

    let db = app.state::<Arc<Database>>();
    if let Ok(Some(record)) = db.get_password(archive_path) {
        if !record.encrypted {
            return Some(record.password);
        }
        // Encrypted passwords need the master password to decrypt — handled in unlock flow
    }

    None
}

fn generate_thumbnail(
    image_data: &[u8],
    output_path: &Path,
) -> Result<(u32, u32), String> {
    let img = image::load_from_memory(image_data)
        .map_err(|e| format!("Failed to decode image: {}", e))?;

    let (w, h) = (img.width(), img.height());
    let max_dim = 400u32;
    let thumb = if w > max_dim || h > max_dim {
        img.thumbnail(max_dim, max_dim)
    } else {
        img
    };

    let (tw, th) = (thumb.width(), thumb.height());

    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create thumb dir: {}", e))?;
    }

    thumb
        .save(output_path)
        .map_err(|e| format!("Failed to save thumbnail: {}", e))?;

    Ok((tw, th))
}

fn archive_error_to_string(e: ArchiveError) -> String {
    format!("{}", e)
}

#[tauri::command]
pub async fn scan_archive(app: AppHandle, params: ScanArchiveParams) -> Result<(), String> {
    let archive_path = params.path.clone();
    let db = app.state::<Arc<Database>>().inner().clone();
    let cache_dir = app.state::<CacheDir>().0.clone();

    let (file_size, mtime) = get_file_metadata(&archive_path)?;
    let archive_hash = compute_archive_hash(&archive_path, file_size, mtime);
    let filename = Path::new(&archive_path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let password = get_password_for_archive(&app, &archive_path, params.password.as_deref());

    // Open archive and list image entries
    let reader = open_archive(Path::new(&archive_path)).map_err(archive_error_to_string)?;
    let entries = reader
        .list_entries(password.as_deref())
        .map_err(archive_error_to_string)?;

    let formats: Vec<String> = params
        .formats
        .iter()
        .map(|f| f.trim_start_matches('.').to_lowercase())
        .collect();

    let mut image_entries: Vec<_> = entries
        .into_iter()
        .filter(|e| {
            if e.is_directory {
                return false;
            }
            let ext = Path::new(&e.path)
                .extension()
                .and_then(|e| e.to_str())
                .map(|e| e.to_lowercase())
                .unwrap_or_default();
            formats.contains(&ext)
        })
        .collect();

    // Sort entries
    match params.sort_method.as_str() {
        "name-asc" => image_entries.sort_by(|a, b| natord::compare(&a.path, &b.path)),
        "name-desc" => image_entries.sort_by(|a, b| natord::compare(&b.path, &a.path)),
        _ => image_entries.sort_by(|a, b| natord::compare(&a.path, &b.path)),
    }

    // Upsert archive record
    let archive_id = {
        // Check if we have an existing record with matching hash
        if let Ok(Some(existing)) = db.get_archive_by_path(&archive_path) {
            if existing.archive_hash == archive_hash {
                db.touch_archive(existing.id)?;
                existing.id
            } else {
                // Archive changed — re-cache
                db.upsert_archive(
                    &archive_path,
                    &filename,
                    file_size as i64,
                    &archive_hash,
                    reader.is_solid().unwrap_or(false),
                    Some(image_entries.len() as i64),
                )?
            }
        } else {
            db.upsert_archive(
                &archive_path,
                &filename,
                file_size as i64,
                &archive_hash,
                reader.is_solid().unwrap_or(false),
                Some(image_entries.len() as i64),
            )?
        }
    };

    // Emit total count
    let _ = app.emit(
        "images:count",
        ImageCount {
            total: image_entries.len(),
        },
    );

    let thumb_dir = cache_dir.join("thumbs").join(&archive_hash);

    // Process in batches
    for chunk in image_entries.chunks(params.page_size) {
        let images: Vec<WImage> = chunk
            .iter()
            .filter_map(|entry| {
                let entry_hash = compute_entry_hash(&entry.path);

                // Check cache first
                if let Ok(Some(thumb)) = db.get_cached_thumbnail(archive_id, &entry.path) {
                    let thumb_full_path = cache_dir.join(&thumb.thumb_path);
                    if thumb_full_path.exists() {
                        return Some(WImage {
                            source: format!("archive:///{}#{}", archive_path, entry.path),
                            relative_path: entry.path.clone(),
                            width: thumb.width,
                            height: thumb.height,
                        });
                    }
                }

                // Cache miss — extract and generate thumbnail
                let thumb_filename = format!("{}.webp", entry_hash);
                let thumb_path = thumb_dir.join(&thumb_filename);
                let relative_thumb = format!("thumbs/{}/{}", archive_hash, thumb_filename);

                let image_data = reader
                    .extract_entry_to_memory(&entry.path, password.as_deref())
                    .ok()?;

                let (tw, th) = generate_thumbnail(&image_data, &thumb_path).ok()?;

                let thumb_size = fs::metadata(&thumb_path).map(|m| m.len()).unwrap_or(0);
                let _ = db.insert_thumbnail(
                    archive_id,
                    &entry.path,
                    &relative_thumb,
                    tw,
                    th,
                    thumb_size as i64,
                );

                Some(WImage {
                    source: format!("archive:///{}#{}", archive_path, entry.path),
                    relative_path: entry.path.clone(),
                    width: Some(tw),
                    height: Some(th),
                })
            })
            .collect();

        let _ = app.emit(
            "images:batch",
            ImageBatch {
                images,
                done: false,
            },
        );
    }

    // Update cache size
    if let Ok(thumbs) = db.get_all_thumbnails_for_archive(archive_id) {
        let total_cache: i64 = thumbs.iter().filter_map(|t| t.file_size).sum();
        let _ = db.update_archive_cache_size(archive_id, total_cache);
    }

    // Final done signal
    let _ = app.emit(
        "images:batch",
        ImageBatch {
            images: vec![],
            done: true,
        },
    );

    Ok(())
}

#[tauri::command]
pub async fn extract_archive_entry(app: AppHandle, uri: String) -> Result<String, String> {
    let (archive_path, entry_path) = parse_archive_uri(&uri).map_err(archive_error_to_string)?;
    let cache_dir = app.state::<CacheDir>().0.clone();

    let (file_size, mtime) = get_file_metadata(&archive_path)?;
    let archive_hash = compute_archive_hash(&archive_path, file_size, mtime);
    let entry_hash = compute_entry_hash(&entry_path);

    let ext = Path::new(&entry_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("bin");
    let extracted_path = cache_dir
        .join("extracted")
        .join(&archive_hash)
        .join(format!("{}.{}", entry_hash, ext));

    // Return cached extracted file if it exists
    if extracted_path.exists() {
        return Ok(extracted_path.to_string_lossy().to_string());
    }

    let password = get_password_for_archive(&app, &archive_path, None);

    let reader = open_archive(Path::new(&archive_path)).map_err(archive_error_to_string)?;
    reader
        .extract_entry(&entry_path, &extracted_path, password.as_deref())
        .map_err(archive_error_to_string)?;

    Ok(extracted_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn get_archive_info(
    app: AppHandle,
    path: String,
) -> Result<ArchiveInfoResponse, String> {
    let password = get_password_for_archive(&app, &path, None);

    let reader = open_archive(Path::new(&path)).map_err(archive_error_to_string)?;
    let info = reader
        .get_info(password.as_deref())
        .map_err(archive_error_to_string)?;

    Ok(ArchiveInfoResponse {
        format: info.format,
        entry_count: info.entry_count,
        total_size: info.total_size,
        is_solid: info.is_solid,
        is_encrypted: info.is_encrypted,
    })
}

#[tauri::command]
pub async fn get_cache_stats(app: AppHandle) -> Result<Vec<CacheStatsResponse>, String> {
    let db = app.state::<Arc<Database>>().inner().clone();
    let archives = db.get_all_archives()?;

    Ok(archives
        .into_iter()
        .map(|a| CacheStatsResponse {
            id: a.id,
            archive_path: a.archive_path,
            filename: a.filename,
            entry_count: a.entry_count,
            cache_size: a.cache_size,
            is_pinned: a.is_pinned,
            last_accessed: a.last_accessed,
        })
        .collect())
}

#[tauri::command]
pub async fn clear_cache(
    app: AppHandle,
    archive_id: Option<i64>,
) -> Result<(), String> {
    let db = app.state::<Arc<Database>>().inner().clone();
    let cache_dir = app.state::<CacheDir>().0.clone();

    if let Some(id) = archive_id {
        // Get the archive hash to find its cache directory
        let archives = db.get_all_archives()?;
        if let Some(archive) = archives.iter().find(|a| a.id == id) {
            // Delete thumbs and extracted dirs
            let thumb_dir = cache_dir.join("thumbs").join(&archive.archive_hash);
            let extracted_dir = cache_dir.join("extracted").join(&archive.archive_hash);
            let _ = fs::remove_dir_all(&thumb_dir);
            let _ = fs::remove_dir_all(&extracted_dir);
        }
        db.delete_archive(id)?;
    } else {
        // Clear all
        let _ = fs::remove_dir_all(cache_dir.join("thumbs"));
        let _ = fs::remove_dir_all(cache_dir.join("extracted"));
        db.delete_all_archives()?;
    }

    Ok(())
}

#[tauri::command]
pub async fn pin_cache(app: AppHandle, archive_id: i64, pinned: bool) -> Result<(), String> {
    let db = app.state::<Arc<Database>>().inner().clone();
    db.set_pinned(archive_id, pinned)
}

#[tauri::command]
pub async fn unlock_archive(
    app: AppHandle,
    path: String,
    password: String,
    remember: bool,
    storage_mode: Option<String>,
    master_password: Option<String>,
) -> Result<(), String> {
    // Validate password by trying to read the archive
    let reader = open_archive(Path::new(&path)).map_err(archive_error_to_string)?;
    let _ = reader
        .list_entries(Some(&password))
        .map_err(archive_error_to_string)?;

    // Store in memory
    let pw_cache = app.state::<PasswordCache>();
    pw_cache.set(&path, &password);

    // Optionally persist
    if remember {
        let db = app.state::<Arc<Database>>().inner().clone();
        let mode = storage_mode.unwrap_or_else(|| "none".to_string());

        match mode.as_str() {
            "plaintext" => {
                db.save_password(&path, &password, false)?;
            }
            "master" => {
                if let Some(mp) = master_password {
                    let encrypted =
                        crate::password::encrypt_password(&password, &mp)?;
                    db.save_password(&path, &encrypted, true)?;
                }
            }
            _ => {}
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn check_migration(
    app: AppHandle,
    path: String,
) -> Result<Option<MigrationCandidate>, String> {
    let db = app.state::<Arc<Database>>().inner().clone();

    // Check exact match first
    if let Some(_) = db.get_archive_by_path(&path)? {
        return Ok(None); // No migration needed
    }

    let filename = Path::new(&path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let (file_size, _) = get_file_metadata(&path)?;

    let candidates = db.find_migration_candidates(&filename, file_size as i64)?;
    if candidates.is_empty() {
        return Ok(None);
    }

    // Reverse path segment comparison
    let normalized_path = path.replace('\\', "/");
    let new_segments: Vec<&str> = normalized_path.split('/').rev().collect();

    let mut best: Option<(i64, String, usize)> = None;

    for candidate in &candidates {
        let old_normalized = candidate.archive_path.replace('\\', "/");
        let old_segments: Vec<&str> = old_normalized.split('/').rev().collect();

        // Count consecutive matches from tail (filename is index 0, must match)
        let mut score = 0;
        for (new_seg, old_seg) in new_segments.iter().zip(old_segments.iter()) {
            if new_seg == old_seg {
                score += 1;
            } else {
                break;
            }
        }

        if score >= 1 {
            // At least filename matches
            if best.is_none() || score > best.as_ref().unwrap().2 {
                best = Some((candidate.id, candidate.archive_path.clone(), score));
            }
        }
    }

    Ok(best.map(|(id, old_path, score)| MigrationCandidate {
        archive_id: id,
        old_path,
        match_score: score,
    }))
}

#[tauri::command]
pub async fn confirm_migration(
    app: AppHandle,
    archive_id: i64,
    new_path: String,
) -> Result<(), String> {
    let db = app.state::<Arc<Database>>().inner().clone();
    let (file_size, mtime) = get_file_metadata(&new_path)?;
    let new_hash = compute_archive_hash(&new_path, file_size, mtime);
    db.update_archive_path(archive_id, &new_path, &new_hash)
}

#[tauri::command]
pub async fn startup_cache_cleanup(
    app: AppHandle,
    strategy: String,
) -> Result<(), String> {
    if strategy != "auto-clean" {
        return Ok(());
    }

    let db = app.state::<Arc<Database>>().inner().clone();
    let cache_dir = app.state::<CacheDir>().0.clone();

    let deleted = db.delete_unpinned_archives()?;
    for archive in &deleted {
        let thumb_dir = cache_dir.join("thumbs").join(&archive.archive_hash);
        let extracted_dir = cache_dir.join("extracted").join(&archive.archive_hash);
        let _ = fs::remove_dir_all(&thumb_dir);
        let _ = fs::remove_dir_all(&extracted_dir);
    }

    Ok(())
}
