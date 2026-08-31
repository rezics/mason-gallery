use crate::database::{Database, SelectionEntryRecord};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectionEntryDto {
    pub package_key: String,
    pub entry_key: String,
    pub locator: String,
    pub relative_path: String,
    pub selected_at: String,
    pub last_seen_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectionStateDto {
    pub mode_enabled: bool,
    pub entries: Vec<SelectionEntryDto>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectionEntryKeyDto {
    pub package_key: String,
    pub entry_key: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectionMutationDto {
    pub mode_enabled: Option<bool>,
    pub upsert: Vec<SelectionEntryDto>,
    pub remove: Vec<SelectionEntryKeyDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectableFileProbeDto {
    pub locator: String,
    pub available: bool,
}

impl From<SelectionEntryRecord> for SelectionEntryDto {
    fn from(record: SelectionEntryRecord) -> Self {
        Self {
            package_key: record.package_key,
            entry_key: record.entry_key,
            locator: record.locator,
            relative_path: record.relative_path,
            selected_at: record.selected_at,
            last_seen_at: record.last_seen_at,
        }
    }
}

impl From<&SelectionEntryDto> for SelectionEntryRecord {
    fn from(dto: &SelectionEntryDto) -> Self {
        Self {
            package_key: dto.package_key.clone(),
            entry_key: dto.entry_key.clone(),
            locator: dto.locator.clone(),
            relative_path: dto.relative_path.clone(),
            selected_at: dto.selected_at.clone(),
            last_seen_at: dto.last_seen_at.clone(),
        }
    }
}

fn keys_from(dtos: &[SelectionEntryKeyDto]) -> Vec<(String, String)> {
    dtos.iter()
        .map(|key| (key.package_key.clone(), key.entry_key.clone()))
        .collect()
}

#[tauri::command]
pub fn load_selection_state(db: State<'_, Arc<Database>>) -> Result<SelectionStateDto, String> {
    let (mode_enabled, entries) = db.load_selection_state()?;
    Ok(SelectionStateDto {
        mode_enabled,
        entries: entries.into_iter().map(SelectionEntryDto::from).collect(),
    })
}

#[tauri::command]
pub fn save_selection_mode(db: State<'_, Arc<Database>>, enabled: bool) -> Result<(), String> {
    db.save_selection_mode(enabled)
}

#[tauri::command]
pub fn upsert_selection_entries(
    db: State<'_, Arc<Database>>,
    entries: Vec<SelectionEntryDto>,
) -> Result<(), String> {
    let records: Vec<SelectionEntryRecord> =
        entries.iter().map(SelectionEntryRecord::from).collect();
    db.upsert_selection_entries(&records)
}

#[tauri::command]
pub fn remove_selection_entries(
    db: State<'_, Arc<Database>>,
    keys: Vec<SelectionEntryKeyDto>,
) -> Result<(), String> {
    db.remove_selection_entries(&keys_from(&keys))
}

#[tauri::command]
pub fn clear_selection_package(
    db: State<'_, Arc<Database>>,
    package_key: String,
) -> Result<(), String> {
    db.clear_selection_package(&package_key)
}

#[tauri::command]
pub fn clear_all_selections(db: State<'_, Arc<Database>>) -> Result<(), String> {
    db.clear_all_selections()
}

#[tauri::command]
pub fn replace_selection_entries(
    db: State<'_, Arc<Database>>,
    remove: Vec<SelectionEntryKeyDto>,
    insert: Vec<SelectionEntryDto>,
) -> Result<(), String> {
    let records: Vec<SelectionEntryRecord> =
        insert.iter().map(SelectionEntryRecord::from).collect();
    db.replace_selection_entries(&keys_from(&remove), &records)
}

#[tauri::command]
pub fn commit_selection_mutation(
    db: State<'_, Arc<Database>>,
    mutation: SelectionMutationDto,
) -> Result<(), String> {
    let records: Vec<SelectionEntryRecord> = mutation
        .upsert
        .iter()
        .map(SelectionEntryRecord::from)
        .collect();
    db.commit_selection_mutation(
        mutation.mode_enabled,
        &records,
        &keys_from(&mutation.remove),
    )
}

pub fn probe_locator(locator: &str) -> bool {
    match std::fs::symlink_metadata(locator) {
        Ok(meta) => meta.file_type().is_file() && !meta.file_type().is_symlink(),
        Err(_) => false,
    }
}

#[tauri::command]
pub fn probe_selectable_files(locators: Vec<String>) -> Vec<SelectableFileProbeDto> {
    locators
        .into_iter()
        .map(|locator| {
            let available = probe_locator(&locator);
            SelectableFileProbeDto { locator, available }
        })
        .collect()
}
