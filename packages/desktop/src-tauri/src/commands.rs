use crate::server::ServerState;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
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

    // Emit total count before dimension extraction
    let _ = app.emit("images:count", ImageCount { total: entries.len() });

    // Process in batches with parallel image dimension extraction
    for chunk in entries.chunks(params.page_size) {
        let images: Vec<WImage> = chunk
            .par_iter()
            .map(|entry| {
                if entry.is_archive {
                    // Archive entries get null dimensions — rendered as virtual folders
                    WImage {
                        source: entry.path.clone(),
                        relative_path: entry.relative_path.clone(),
                        width: None,
                        height: None,
                        thumbnails: None,
                    }
                } else {
                    let (width, height) = get_image_dimensions(Path::new(&entry.path));
                    WImage {
                        source: entry.path.clone(),
                        relative_path: entry.relative_path.clone(),
                        width,
                        height,
                        thumbnails: None,
                    }
                }
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
