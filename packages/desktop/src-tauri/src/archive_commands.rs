use crate::archive::{compute_entry_hash, open_archive, ArchiveError};
use crate::commands::{ImageBatch, ImageCount, WImage, WThumbnail};
use crate::database::Database;
use crate::password::PasswordCache;
use crate::server::SharedPolicy;
use crate::services::archive_service::ArchiveService;
use crate::services::image_service::ImageService;
use crate::services::policy::{CachePolicy, CachePolicyOverride};
use crate::services::source_service::{SourceKind, SourceService};
use crate::services::thumbnail_service::ThumbnailService;
use crate::CacheDir;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanArchiveParams {
    pub path: String,
    pub formats: Vec<String>,
    pub page_size: usize,
    pub sort_method: String,
    pub password: Option<String>,
    #[serde(default)]
    pub thumbnail_sizes: Option<Vec<u32>>,
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
    pub kind: String,
    pub origin_path: String,
    pub identity_segment: String,
    pub entry_count: Option<i64>,
    pub thumb_cache_size: i64,
    pub extracted_cache_size: i64,
    pub is_pinned: bool,
    pub last_accessed: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub policy_override: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrationCandidateResp {
    pub source_id: i64,
    pub old_path: String,
    pub kind: String,
    pub match_score: usize,
}

fn archive_error_to_string(e: ArchiveError) -> String {
    format!("{}", e)
}

fn get_password_for_archive(
    app: &AppHandle,
    archive_path: &str,
    explicit_password: Option<&str>,
) -> Option<String> {
    if let Some(pw) = explicit_password {
        return Some(pw.to_string());
    }

    let pw_cache = app.state::<Arc<PasswordCache>>();
    if let Some(pw) = pw_cache.get(archive_path) {
        return Some(pw);
    }

    let db = app.state::<Arc<Database>>();
    if let Ok(Some(record)) = db.get_password(archive_path) {
        if !record.encrypted {
            return Some(record.password);
        }
    }

    None
}

fn default_thumbnail_widths() -> Vec<u32> {
    vec![400, 800, 1600]
}

#[tauri::command]
pub async fn scan_archive(app: AppHandle, params: ScanArchiveParams) -> Result<(), String> {
    let archive_path = params.path.clone();
    let db = app.state::<Arc<Database>>().inner().clone();
    let source_svc = app.state::<Arc<SourceService>>().inner().clone();
    let thumbnail_svc = app.state::<Arc<ThumbnailService>>().inner().clone();

    let widths = params
        .thumbnail_sizes
        .clone()
        .filter(|v| !v.is_empty())
        .unwrap_or_else(default_thumbnail_widths);

    let password = get_password_for_archive(&app, &archive_path, params.password.as_deref());

    let reader = open_archive(Path::new(&archive_path)).map_err(archive_error_to_string)?;
    let entries = reader
        .list_entries(password.as_deref())
        .map_err(archive_error_to_string)?;
    let is_solid = reader.is_solid().unwrap_or(false);

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

    match params.sort_method.as_str() {
        "name-asc" => image_entries.sort_by(|a, b| natord::compare(&a.path, &b.path)),
        "name-desc" => image_entries.sort_by(|a, b| natord::compare(&b.path, &a.path)),
        _ => image_entries.sort_by(|a, b| natord::compare(&a.path, &b.path)),
    }

    let (source_rec, _size) =
        source_svc.open_or_create_archive(&archive_path, Some(is_solid), Some(image_entries.len() as i64))?;
    let source_id = source_rec.id;
    let source_hash = source_rec.content_hash.clone();

    let _ = app.emit(
        "images:count",
        ImageCount {
            total: image_entries.len(),
        },
    );

    // Probe for password errors early: pick first uncached entry and extract.
    if !image_entries.is_empty() {
        let probe = image_entries.iter().find(|entry| {
            let existing = db.get_thumbnails_by_entry(source_id, &entry.path).ok();
            existing.as_ref().map(|v| v.is_empty()).unwrap_or(true)
        });
        if let Some(entry) = probe {
            reader
                .extract_entry_to_memory(&entry.path, password.as_deref())
                .map_err(archive_error_to_string)?;
        }
    }

    for chunk in image_entries.chunks(params.page_size) {
        let mut images: Vec<WImage> = Vec::with_capacity(chunk.len());
        for entry in chunk {
            let entry_hash = compute_entry_hash(&entry.path);

            // Gather existing thumbs; figure out which widths still need generation.
            let existing = db
                .get_thumbnails_by_entry(source_id, &entry.path)
                .unwrap_or_default();
            let existing_widths: std::collections::HashSet<u32> =
                existing.iter().map(|t| t.width).collect();
            let missing: Vec<u32> = widths
                .iter()
                .copied()
                .filter(|w| !existing_widths.contains(w))
                .collect();

            let mut all_thumbs: Vec<WThumbnail> = existing
                .iter()
                .map(|t| WThumbnail {
                    source: ThumbnailService::build_uri(&source_hash, &entry_hash, t.width),
                    width: t.width,
                    height: t.height,
                })
                .collect();

            let mut width_hint: Option<u32> = existing.iter().map(|t| t.width).max();
            let mut height_hint: Option<u32> = existing
                .iter()
                .max_by_key(|t| t.width)
                .map(|t| t.height);

            if !missing.is_empty() {
                match reader.extract_entry_to_memory(&entry.path, password.as_deref()) {
                    Ok(data) => {
                        match thumbnail_svc.generate_for_entry(
                            source_id,
                            &source_hash,
                            &entry.path,
                            &data,
                            &missing,
                        ) {
                            Ok(generated) => {
                                for g in &generated {
                                    all_thumbs.push(WThumbnail {
                                        source: ThumbnailService::build_uri(
                                            &source_hash,
                                            &entry_hash,
                                            g.width,
                                        ),
                                        width: g.width,
                                        height: g.height,
                                    });
                                    if width_hint.map(|w| g.width > w).unwrap_or(true) {
                                        width_hint = Some(g.width);
                                        height_hint = Some(g.height);
                                    }
                                }
                            }
                            Err(_) => continue,
                        }
                    }
                    Err(_) => continue,
                }
            }

            // Dedup & sort by width ascending.
            all_thumbs.sort_by_key(|t| t.width);
            all_thumbs.dedup_by_key(|t| t.width);

            images.push(WImage {
                source: format!("archive:///{}#{}", archive_path, entry.path),
                relative_path: entry.path.clone(),
                width: width_hint,
                height: height_hint,
                thumbnails: Some(all_thumbs),
            });
        }

        let _ = app.emit(
            "images:batch",
            ImageBatch {
                images,
                done: false,
            },
        );
    }

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
    let sources = db.get_all_sources()?;
    Ok(sources
        .into_iter()
        .map(|s| CacheStatsResponse {
            id: s.id,
            kind: s.kind,
            origin_path: s.origin_path,
            identity_segment: s.identity_segment,
            entry_count: s.entry_count,
            thumb_cache_size: s.thumb_cache_size,
            extracted_cache_size: s.extracted_cache_size,
            is_pinned: s.is_pinned,
            last_accessed: s.last_accessed,
            policy_override: s.policy_override,
        })
        .collect())
}

#[tauri::command]
pub async fn clear_thumbnails(app: AppHandle, source_id: Option<i64>) -> Result<(), String> {
    let db = app.state::<Arc<Database>>().inner().clone();
    let thumbnail_svc = app.state::<Arc<ThumbnailService>>().inner().clone();

    if let Some(id) = source_id {
        let rec = db
            .get_source_by_id(id)?
            .ok_or_else(|| format!("Source {} not found", id))?;
        thumbnail_svc.clear_for_source(id, &rec.content_hash)?;
    } else {
        thumbnail_svc.clear_all()?;
    }
    Ok(())
}

#[tauri::command]
pub async fn clear_extracted(app: AppHandle, source_id: Option<i64>) -> Result<(), String> {
    let db = app.state::<Arc<Database>>().inner().clone();
    let image_svc = app.state::<Arc<ImageService>>().inner().clone();

    if let Some(id) = source_id {
        let rec = db
            .get_source_by_id(id)?
            .ok_or_else(|| format!("Source {} not found", id))?;
        image_svc.clear_for_source(id, &rec.content_hash)?;
    } else {
        image_svc.clear_all()?;
    }
    Ok(())
}

#[tauri::command]
pub async fn pin_cache(app: AppHandle, source_id: i64, pinned: bool) -> Result<(), String> {
    let db = app.state::<Arc<Database>>().inner().clone();
    db.set_source_pinned(source_id, pinned)
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
    let reader = open_archive(Path::new(&path)).map_err(archive_error_to_string)?;
    let _ = reader
        .list_entries(Some(&password))
        .map_err(archive_error_to_string)?;

    let pw_cache = app.state::<Arc<PasswordCache>>();
    pw_cache.set(&path, &password);

    if remember {
        let db = app.state::<Arc<Database>>().inner().clone();
        let mode = storage_mode.unwrap_or_else(|| "none".to_string());

        match mode.as_str() {
            "plaintext" => {
                db.save_password(&path, &password, false)?;
            }
            "master" => {
                if let Some(mp) = master_password {
                    let encrypted = crate::password::encrypt_password(&password, &mp)?;
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
) -> Result<Option<MigrationCandidateResp>, String> {
    let source_svc = app.state::<Arc<SourceService>>().inner().clone();

    let kind = if Path::new(&path).is_dir() {
        SourceKind::Folder
    } else {
        SourceKind::Archive
    };

    let candidate = source_svc.find_migration_candidate(&path, kind)?;
    Ok(candidate.map(|c| MigrationCandidateResp {
        source_id: c.source_id,
        old_path: c.old_path,
        kind: c.kind,
        match_score: c.match_score,
    }))
}

#[tauri::command]
pub async fn confirm_migration(
    app: AppHandle,
    source_id: i64,
    new_path: String,
) -> Result<(), String> {
    let source_svc = app.state::<Arc<SourceService>>().inner().clone();
    source_svc.confirm_migration(source_id, &new_path)
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

    let deleted = db.delete_unpinned_sources()?;
    for src in &deleted {
        let thumbs = cache_dir.join("thumbs").join(&src.content_hash);
        let extracted = cache_dir.join("extracted").join(&src.content_hash);
        let _ = std::fs::remove_dir_all(&thumbs);
        let _ = std::fs::remove_dir_all(&extracted);
    }

    Ok(())
}

#[tauri::command]
pub async fn set_cache_policy(app: AppHandle, policy: CachePolicy) -> Result<(), String> {
    let shared = app.state::<SharedPolicy>();
    let mut p = shared.write().map_err(|e| format!("Lock error: {}", e))?;
    *p = policy;
    Ok(())
}

#[tauri::command]
pub async fn set_source_policy(
    app: AppHandle,
    source_id: i64,
    policy_override: Option<CachePolicyOverride>,
) -> Result<(), String> {
    let db = app.state::<Arc<Database>>().inner().clone();
    let json = match policy_override {
        Some(o) => Some(
            serde_json::to_string(&o)
                .map_err(|e| format!("Failed to encode override: {}", e))?,
        ),
        None => None,
    };
    db.set_source_policy(source_id, json.as_deref())
}

