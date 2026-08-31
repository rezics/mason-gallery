use crate::database::Database;
use serde_json::Value;
use std::sync::Arc;
use tauri::State;

const SETTINGS_DOCUMENT_VERSION: u64 = 2;
const SETTINGS_DOCUMENT_MIN_READ_VERSION: u64 = 1;

fn read_settings_version(envelope: &Value) -> Result<u64, String> {
    let object = envelope
        .as_object()
        .ok_or_else(|| "Settings envelope must be an object".to_string())?;
    let version = object
        .get("version")
        .and_then(Value::as_u64)
        .ok_or_else(|| "Settings envelope is missing a numeric version".to_string())?;
    if !object.get("settings").is_some_and(Value::is_object) {
        return Err("Settings envelope is missing a settings object".to_string());
    }
    Ok(version)
}

fn validate_settings_envelope_for_load(envelope: &Value) -> Result<i64, String> {
    let version = read_settings_version(envelope)?;
    if !(SETTINGS_DOCUMENT_MIN_READ_VERSION..=SETTINGS_DOCUMENT_VERSION).contains(&version) {
        return Err(format!("Unsupported settings schema version: {version}"));
    }
    Ok(version as i64)
}

fn validate_settings_envelope_for_save(envelope: &Value) -> Result<i64, String> {
    let version = read_settings_version(envelope)?;
    if version != SETTINGS_DOCUMENT_VERSION {
        return Err(format!(
            "Settings must be saved as schema version {SETTINGS_DOCUMENT_VERSION}"
        ));
    }
    Ok(version as i64)
}

#[tauri::command]
pub fn load_settings(db: State<'_, Arc<Database>>) -> Result<Option<Value>, String> {
    db.load_settings_document()?
        .map(|document| {
            let envelope: Value = serde_json::from_str(&document)
                .map_err(|e| format!("Stored settings document is invalid JSON: {e}"))?;
            validate_settings_envelope_for_load(&envelope)?;
            Ok(envelope)
        })
        .transpose()
}

#[tauri::command]
pub fn save_settings(db: State<'_, Arc<Database>>, envelope: Value) -> Result<(), String> {
    let version = validate_settings_envelope_for_save(&envelope)?;
    let document = serde_json::to_string(&envelope)
        .map_err(|e| format!("Failed to serialize settings document: {e}"))?;
    db.save_settings_document(version, &document)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn load_accepts_v1_and_v2_envelopes() {
        assert_eq!(
            validate_settings_envelope_for_load(&json!({"version": 1, "settings": {}})),
            Ok(1)
        );
        assert_eq!(
            validate_settings_envelope_for_load(&json!({"version": 2, "settings": {}})),
            Ok(2)
        );
        assert!(validate_settings_envelope_for_load(&json!({"settings": {}})).is_err());
        assert!(
            validate_settings_envelope_for_load(&json!({"version": 3, "settings": {}})).is_err()
        );
    }

    #[test]
    fn save_requires_current_v2_envelope() {
        assert_eq!(
            validate_settings_envelope_for_save(&json!({"version": 2, "settings": {}})),
            Ok(2)
        );
        assert!(
            validate_settings_envelope_for_save(&json!({"version": 1, "settings": {}})).is_err()
        );
        assert!(validate_settings_envelope_for_save(&json!({"settings": {}})).is_err());
    }
}
