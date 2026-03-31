use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::time::SystemTime;
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WImage {
    pub source: String,
    pub width: Option<u32>,
    pub height: Option<u32>,
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
    modified: Option<SystemTime>,
}

#[tauri::command]
pub async fn scan_directory(app: AppHandle, params: ScanParams) -> Result<(), String> {
    let formats: Vec<String> = params
        .formats
        .iter()
        .map(|f| f.trim_start_matches('.').to_lowercase())
        .collect();

    // Collect all matching files
    let mut entries: Vec<FileEntry> = Vec::new();

    for dir_path in &params.paths {
        let path = Path::new(dir_path);
        if !path.exists() {
            return Err(format!("Path does not exist: {}", dir_path));
        }

        for entry in WalkDir::new(path).follow_links(true).into_iter().flatten() {
            if !entry.file_type().is_file() {
                continue;
            }

            let ext = entry
                .path()
                .extension()
                .and_then(|e| e.to_str())
                .map(|e| e.to_lowercase())
                .unwrap_or_default();

            if formats.contains(&ext) {
                let modified = fs::metadata(entry.path()).and_then(|m| m.modified()).ok();

                entries.push(FileEntry {
                    path: entry.path().to_string_lossy().to_string(),
                    modified,
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
                let (width, height) = get_image_dimensions(Path::new(&entry.path));
                WImage {
                    source: entry.path.clone(),
                    width,
                    height,
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

#[tauri::command]
pub async fn delete_to_trash(path: String) -> Result<(), String> {
    trash::delete(&path).map_err(|e| format!("Failed to delete to trash: {}", e))
}

#[tauri::command]
pub async fn open_devtools(window: tauri::WebviewWindow) {
    window.open_devtools();
}
