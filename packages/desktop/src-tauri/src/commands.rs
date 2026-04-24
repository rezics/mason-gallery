use crate::archive::compute_entry_hash;
use crate::archive_commands::{expand_archive_for_folder_scan, MixedArchiveOutcome};
use crate::database::Database;
use crate::server::{ServerState, SharedPolicy};
use crate::services::policy;
use crate::services::source_service::SourceService;
use crate::services::thumbnail_queue::{EnqueueOutcome, Key, ThumbnailQueue};
use crate::services::thumbnail_service::ThumbnailService;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::SystemTime;
use tauri::{AppHandle, Emitter, Manager};
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WThumbnail {
    pub source: String,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WImage {
    pub source: String,
    pub relative_path: String,
    pub width: Option<u32>,
    pub height: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thumbnails: Option<Vec<WThumbnail>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub locked: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageBatch {
    pub images: Vec<WImage>,
    pub done: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct ImageCount {
    pub total: usize,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ScanParams {
    pub paths: Vec<String>,
    pub formats: Vec<String>,
    pub page_size: usize,
    pub sort_method: String,
}

fn get_image_dimensions(path: &Path) -> (Option<u32>, Option<u32>) {
    match image::image_dimensions(path) {
        Ok((w, h)) => (Some(w), Some(h)),
        Err(_) => (None, None),
    }
}

struct FileEntry {
    path: String,
    relative_path: String,
    modified: Option<SystemTime>,
    is_archive: bool,
    /// Which input path this entry was discovered under — determines the folder
    /// source row to key the entry against.
    root_path: String,
}

#[tauri::command]
pub async fn scan_directory(app: AppHandle, params: ScanParams) -> Result<(), String> {
    // Register scanned directories with the image server's allowed roots
    let server_state = app.state::<ServerState>();
    {
        let mut roots = server_state.allowed_roots.write().unwrap();
        for dir_path in &params.paths {
            if let Ok(canonical) = fs::canonicalize(dir_path) {
                roots.insert(canonical);
            } else {
                roots.insert(PathBuf::from(dir_path));
            }
        }
    }

    let formats: Vec<String> = params
        .formats
        .iter()
        .map(|f| f.trim_start_matches('.').to_lowercase())
        .collect();

    // Register a `sources` row per input folder so loose files can be keyed by
    // their folder source id (needed for lazy thumbnail requests).
    let source_svc = app.state::<Arc<SourceService>>().inner().clone();
    let mut folder_source_ids: std::collections::HashMap<String, i64> =
        std::collections::HashMap::new();
    for dir_path in &params.paths {
        match source_svc.open_or_create_folder(dir_path, None) {
            Ok(rec) => {
                folder_source_ids.insert(dir_path.clone(), rec.id);
            }
            Err(e) => eprintln!("Failed to register folder source {}: {}", dir_path, e),
        }
    }

    // Collect all matching files
    let mut entries: Vec<FileEntry> = Vec::new();

    for dir_path in &params.paths {
        let root = Path::new(dir_path);
        if !root.exists() {
            return Err(format!("Path does not exist: {}", dir_path));
        }

        for entry in WalkDir::new(root).follow_links(true).into_iter().flatten() {
            if !entry.file_type().is_file() {
                continue;
            }

            let ext = entry
                .path()
                .extension()
                .and_then(|e| e.to_str())
                .map(|e| e.to_lowercase())
                .unwrap_or_default();

            if formats.contains(&ext) || crate::archive::is_archive_extension(&ext) {
                let modified = fs::metadata(entry.path()).and_then(|m| m.modified()).ok();

                let relative_path = entry
                    .path()
                    .strip_prefix(root)
                    .unwrap_or(entry.path())
                    .to_string_lossy()
                    .replace('\\', "/");

                entries.push(FileEntry {
                    path: entry.path().to_string_lossy().to_string(),
                    relative_path,
                    modified,
                    is_archive: crate::archive::is_archive_extension(&ext),
                    root_path: dir_path.clone(),
                });
            }
        }
    }

    // Sort
    match params.sort_method.as_str() {
        "name-asc" => entries.sort_by(|a, b| natord::compare(&a.path, &b.path)),
        "name-desc" => entries.sort_by(|a, b| natord::compare(&b.path, &a.path)),
        "time-asc" => entries.sort_by(|a, b| a.modified.cmp(&b.modified)),
        "time-desc" => entries.sort_by(|a, b| b.modified.cmp(&a.modified)),
        _ => entries.sort_by(|a, b| natord::compare(&a.path, &b.path)),
    }

    // Loose-file dimensions in parallel (archives are handled sequentially below).
    let loose_dims: std::collections::HashMap<String, (Option<u32>, Option<u32>)> = entries
        .par_iter()
        .filter(|e| !e.is_archive)
        .map(|e| (e.path.clone(), get_image_dimensions(Path::new(&e.path))))
        .collect();

    // Initial count = discovered items (archives count as 1 until expansion
    // refines the total). Frontend tolerates count updates.
    let _ = app.emit(
        "images:count",
        ImageCount {
            total: entries.len(),
        },
    );

    let mut pending: Vec<WImage> = Vec::with_capacity(params.page_size);
    let mut total_emitted: usize = 0;

    for entry in &entries {
        if entry.is_archive {
            match expand_archive_for_folder_scan(
                &app,
                &entry.path,
                &formats,
                &params.sort_method,
            ) {
                MixedArchiveOutcome::Entries(archive_imgs) => {
                    for img in archive_imgs {
                        pending.push(img);
                        if pending.len() >= params.page_size {
                            total_emitted += pending.len();
                            let _ = app.emit(
                                "images:batch",
                                ImageBatch {
                                    images: std::mem::take(&mut pending),
                                    done: false,
                                },
                            );
                        }
                    }
                }
                MixedArchiveOutcome::Locked(placeholder) => {
                    pending.push(placeholder);
                    if pending.len() >= params.page_size {
                        total_emitted += pending.len();
                        let _ = app.emit(
                            "images:batch",
                            ImageBatch {
                                images: std::mem::take(&mut pending),
                                done: false,
                            },
                        );
                    }
                }
                MixedArchiveOutcome::Skipped(msg) => {
                    eprintln!("Skipping archive {}: {}", entry.path, msg);
                }
            }
        } else {
            let (width, height) = loose_dims
                .get(&entry.path)
                .copied()
                .unwrap_or((None, None));
            pending.push(WImage {
                source: entry.path.clone(),
                relative_path: entry.relative_path.clone(),
                width,
                height,
                thumbnails: None,
                source_id: folder_source_ids.get(&entry.root_path).copied(),
                locked: None,
            });
            if pending.len() >= params.page_size {
                total_emitted += pending.len();
                let _ = app.emit(
                    "images:batch",
                    ImageBatch {
                        images: std::mem::take(&mut pending),
                        done: false,
                    },
                );
            }
        }
    }

    if !pending.is_empty() {
        total_emitted += pending.len();
        let _ = app.emit(
            "images:batch",
            ImageBatch {
                images: std::mem::take(&mut pending),
                done: false,
            },
        );
    }

    // Final count covers archive expansion.
    let _ = app.emit(
        "images:count",
        ImageCount {
            total: total_emitted,
        },
    );

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

#[derive(Debug, Clone, Serialize)]
pub struct DirectoryTree {
    pub directories: Vec<String>,
}

#[tauri::command]
pub async fn list_directory_tree(paths: Vec<String>) -> Result<DirectoryTree, String> {
    let mut directories: Vec<String> = Vec::new();

    for dir_path in &paths {
        let root = Path::new(dir_path);
        if !root.exists() {
            return Err(format!("Path does not exist: {}", dir_path));
        }

        for entry in WalkDir::new(root).follow_links(true).into_iter().flatten() {
            if !entry.file_type().is_dir() {
                continue;
            }
            // Skip the root itself
            if entry.path() == root {
                continue;
            }
            let relative = entry
                .path()
                .strip_prefix(root)
                .unwrap_or(entry.path())
                .to_string_lossy()
                .replace('\\', "/");
            directories.push(relative);
        }
    }

    directories.sort();
    directories.dedup();

    Ok(DirectoryTree { directories })
}

#[tauri::command]
pub async fn delete_to_trash(path: String) -> Result<(), String> {
    trash::delete(&path).map_err(|e| format!("Failed to delete to trash: {}", e))
}

#[tauri::command]
pub async fn get_image_server_port(app: AppHandle) -> Result<u16, String> {
    let state = app.state::<ServerState>();
    Ok(state.port)
}

#[tauri::command]
pub async fn open_devtools(window: tauri::WebviewWindow) {
    window.open_devtools();
}

// ---- Lazy thumbnail pipeline ----

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestThumbnailParams {
    pub source_id: i64,
    pub entry_path: String,
    #[serde(default)]
    pub widths: Vec<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestThumbnailResult {
    pub enqueued: bool,
    pub skipped: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThumbnailsReadyPayload {
    pub source_id: i64,
    pub entry_path: String,
    pub thumbnails: Vec<WThumbnail>,
}

#[tauri::command]
pub async fn request_thumbnail(
    app: AppHandle,
    params: RequestThumbnailParams,
) -> Result<RequestThumbnailResult, String> {
    let db = app.state::<Arc<Database>>().inner().clone();
    let policy_state = app.state::<SharedPolicy>().inner().clone();
    let queue = app.state::<Arc<ThumbnailQueue>>().inner().clone();

    // Default path uses the policy-resolved widths; a non-empty `params.widths`
    // is an explicit override from the frontend (e.g. for one-off requests).
    let widths = if params.widths.is_empty() {
        let override_json = db
            .get_source_by_id(params.source_id)
            .ok()
            .flatten()
            .and_then(|r| r.policy_override);
        let global = policy_state
            .read()
            .map(|p| p.clone())
            .unwrap_or_default();
        policy::resolve_widths(override_json.as_deref(), &global)
    } else {
        params.widths.clone()
    };

    // Early exit: all widths already on disk.
    let existing = db
        .get_thumbnails_by_entry(params.source_id, &params.entry_path)
        .unwrap_or_default();
    let existing_widths: std::collections::HashSet<u32> =
        existing.iter().map(|t| t.width).collect();
    let all_present = widths.iter().all(|w| existing_widths.contains(w));
    if all_present {
        return Ok(RequestThumbnailResult {
            enqueued: false,
            skipped: false,
            reason: Some("already-cached".to_string()),
        });
    }

    // minFileSize gate (applies to folder files; absolute path on disk).
    let min_size = policy_state
        .read()
        .ok()
        .and_then(|p| p.extracted.min_file_size);
    if let Some(min) = min_size {
        if let Ok(meta) = fs::metadata(&params.entry_path) {
            if (meta.len() as i64) < min {
                return Ok(RequestThumbnailResult {
                    enqueued: false,
                    skipped: true,
                    reason: Some("below-min-file-size".to_string()),
                });
            }
        }
    }

    let key: Key = (params.source_id, params.entry_path.clone());
    match queue.enqueue(key) {
        EnqueueOutcome::New(_) => Ok(RequestThumbnailResult {
            enqueued: true,
            skipped: false,
            reason: None,
        }),
        EnqueueOutcome::AlreadyPending(_) => Ok(RequestThumbnailResult {
            enqueued: false,
            skipped: false,
            reason: Some("already-queued".to_string()),
        }),
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CancelThumbnailParams {
    pub source_id: i64,
    pub entry_path: String,
}

#[tauri::command]
pub async fn cancel_thumbnail(
    app: AppHandle,
    params: CancelThumbnailParams,
) -> Result<(), String> {
    let queue = app.state::<Arc<ThumbnailQueue>>().inner().clone();
    queue.cancel(&(params.source_id, params.entry_path));
    Ok(())
}

/// Long-running worker: LIFO-pops keys, acquires a permit, runs generation on a
/// blocking thread, and emits `images:thumbnails` on success. Cancellation is
/// checked before dequeue, before the permit, and inside the generator.
pub async fn run_thumbnail_worker(
    app: AppHandle,
    queue: Arc<ThumbnailQueue>,
    thumbnail_svc: Arc<ThumbnailService>,
    source_svc: Arc<SourceService>,
    policy_state: SharedPolicy,
) {
    use std::sync::atomic::Ordering;

    let notify = queue.notify();
    let semaphore = queue.semaphore();

    loop {
        let key = match queue.pop_lifo() {
            Some(k) => k,
            None => {
                notify.notified().await;
                continue;
            }
        };

        let slot = match queue.slot_for(&key) {
            Some(s) => s,
            None => continue,
        };

        if slot.cancel.load(Ordering::Acquire) {
            queue.complete(&key);
            continue;
        }

        let permit = match semaphore.clone().acquire_owned().await {
            Ok(p) => p,
            Err(_) => break, // semaphore closed — shut down
        };

        if slot.cancel.load(Ordering::Acquire) {
            drop(permit);
            queue.complete(&key);
            continue;
        }

        let (source_hash, override_json) = match source_svc.db().get_source_by_id(key.0) {
            Ok(Some(rec)) => (rec.content_hash, rec.policy_override),
            _ => {
                drop(permit);
                queue.complete(&key);
                continue;
            }
        };

        let global_policy = policy_state
            .read()
            .map(|p| p.clone())
            .unwrap_or_default();
        let widths = policy::resolve_widths(override_json.as_deref(), &global_policy);
        let svc = thumbnail_svc.clone();
        let cancel_flag = slot.cancel.clone();
        let entry_path = key.1.clone();
        let source_id = key.0;
        let hash_for_gen = source_hash.clone();

        let result = tokio::task::spawn_blocking(move || {
            svc.generate_for_file(
                source_id,
                &hash_for_gen,
                &entry_path,
                &widths,
                Some(&cancel_flag),
            )
        })
        .await;

        drop(permit);

        if slot.cancel.load(Ordering::Acquire) {
            queue.complete(&key);
            continue;
        }

        match result {
            Ok(Ok(generated)) => {
                let entry_hash = compute_entry_hash(&key.1);
                let thumbnails: Vec<WThumbnail> = generated
                    .into_iter()
                    .map(|g| WThumbnail {
                        source: ThumbnailService::build_uri(
                            &source_hash,
                            &entry_hash,
                            g.width,
                        ),
                        width: g.width,
                        height: g.height,
                    })
                    .collect();

                let _ = app.emit(
                    "images:thumbnails",
                    ThumbnailsReadyPayload {
                        source_id: key.0,
                        entry_path: key.1.clone(),
                        thumbnails,
                    },
                );
            }
            Ok(Err(e)) if e == "canceled" => {
                // Cooperatively aborted — no event.
            }
            Ok(Err(e)) => {
                eprintln!("Thumbnail generation failed for {:?}: {}", key, e);
            }
            Err(e) => {
                eprintln!("Thumbnail spawn_blocking panicked for {:?}: {}", key, e);
            }
        }

        queue.complete(&key);
    }
}
