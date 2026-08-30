use crate::database::{
    normalize_library_path_key, Database, LibrarySourceRecord, UpsertLibrarySourceParams,
};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Arc;
use tauri::State;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibrarySourceInput {
    pub kind: String,
    pub path: String,
    pub label: Option<String>,
    pub last_opened_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibrarySourcePatch {
    pub label: Option<String>,
    pub is_favorite: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibrarySourceResponse {
    pub id: i64,
    pub kind: String,
    pub path: String,
    pub label: String,
    pub is_favorite: bool,
    pub added_at: String,
    pub last_opened_at: Option<String>,
    pub last_scanned_at: Option<String>,
    pub image_count: Option<i64>,
    pub access_status: String,
}

struct NormalizedSourceInput {
    kind: String,
    path: String,
    path_key: String,
    label: String,
    last_opened_at: Option<String>,
}

fn default_label(path: &str) -> String {
    Path::new(path)
        .file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or(path)
        .to_string()
}

fn normalize_source(input: LibrarySourceInput) -> Result<NormalizedSourceInput, String> {
    if input.kind != "folder" && input.kind != "archive" {
        return Err(format!("Unsupported gallery source kind: {}", input.kind));
    }
    let path = input.path.trim().to_string();
    if path.is_empty() {
        return Err("Gallery source path cannot be empty".to_string());
    }
    let label = input
        .label
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| default_label(&path));

    Ok(NormalizedSourceInput {
        kind: input.kind,
        path_key: normalize_library_path_key(&path),
        path,
        label,
        last_opened_at: input.last_opened_at,
    })
}

fn to_response(
    db: &Database,
    source: LibrarySourceRecord,
) -> Result<LibrarySourceResponse, String> {
    let cached = db.get_source_by_path(&source.origin_path)?;
    let path = Path::new(&source.origin_path);
    let access_status = if path.exists() { "ready" } else { "missing" };

    Ok(LibrarySourceResponse {
        id: source.id,
        kind: source.kind,
        path: source.origin_path,
        label: source.display_name,
        is_favorite: source.is_favorite,
        added_at: source.added_at,
        last_opened_at: source.last_opened_at,
        last_scanned_at: source.last_scanned_at.or_else(|| {
            cached
                .as_ref()
                .and_then(|record| record.last_accessed.clone())
        }),
        image_count: source
            .image_count
            .or_else(|| cached.as_ref().and_then(|record| record.entry_count)),
        access_status: access_status.to_string(),
    })
}

fn list_responses(db: &Database) -> Result<Vec<LibrarySourceResponse>, String> {
    db.get_library_sources()?
        .into_iter()
        .map(|source| to_response(db, source))
        .collect()
}

#[tauri::command]
pub fn list_library_sources(
    db: State<'_, Arc<Database>>,
) -> Result<Vec<LibrarySourceResponse>, String> {
    list_responses(&db)
}

#[tauri::command]
pub fn add_library_sources(
    db: State<'_, Arc<Database>>,
    sources: Vec<LibrarySourceInput>,
) -> Result<Vec<LibrarySourceResponse>, String> {
    let normalized = sources
        .into_iter()
        .map(normalize_source)
        .collect::<Result<Vec<_>, _>>()?;
    let params = normalized
        .iter()
        .map(|source| UpsertLibrarySourceParams {
            kind: &source.kind,
            origin_path: &source.path,
            path_key: &source.path_key,
            display_name: &source.label,
            last_opened_at: source.last_opened_at.as_deref(),
        })
        .collect::<Vec<_>>();
    db.upsert_library_sources(&params)?;
    list_responses(&db)
}

#[tauri::command]
pub fn update_library_source(
    db: State<'_, Arc<Database>>,
    id: i64,
    patch: LibrarySourcePatch,
) -> Result<Vec<LibrarySourceResponse>, String> {
    let label = patch.label.map(|value| value.trim().to_string());
    if label.as_ref().is_some_and(String::is_empty) {
        return Err("Gallery display name cannot be empty".to_string());
    }
    db.update_library_source(id, label.as_deref(), patch.is_favorite)?;
    list_responses(&db)
}

#[tauri::command]
pub fn remove_library_sources(
    db: State<'_, Arc<Database>>,
    ids: Vec<i64>,
) -> Result<Vec<LibrarySourceResponse>, String> {
    db.remove_library_sources(&ids)?;
    list_responses(&db)
}

#[tauri::command]
pub fn mark_library_sources_scanned(
    db: State<'_, Arc<Database>>,
    paths: Vec<String>,
    image_count: Option<i64>,
) -> Result<(), String> {
    if image_count.is_some_and(|value| value < 0) {
        return Err("Gallery image count cannot be negative".to_string());
    }
    let path_keys = paths
        .iter()
        .map(|path| normalize_library_path_key(path))
        .collect::<Vec<_>>();
    db.mark_library_sources_scanned(&path_keys, image_count)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_empty_and_unknown_sources() {
        assert!(normalize_source(LibrarySourceInput {
            kind: "folder".to_string(),
            path: " ".to_string(),
            label: None,
            last_opened_at: None,
        })
        .is_err());
        assert!(normalize_source(LibrarySourceInput {
            kind: "remote".to_string(),
            path: "D:/photos".to_string(),
            label: None,
            last_opened_at: None,
        })
        .is_err());
    }
}
