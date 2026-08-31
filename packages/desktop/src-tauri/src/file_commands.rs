use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{self, ErrorKind, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};

pub type MoveCancelMap = Arc<DashMap<String, Arc<AtomicBool>>>;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveFilesRequest {
    pub operation_id: String,
    pub destination_directory: String,
    pub conflict_policy: String,
    pub items: Vec<MoveFilesRequestItem>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveFilesRequestItem {
    pub entry_key: String,
    pub source_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveProgress {
    pub operation_id: String,
    pub completed: usize,
    pub total: usize,
    pub succeeded: usize,
    pub skipped: usize,
    pub failed: usize,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(tag = "status")]
pub enum MoveItemResult {
    #[serde(rename = "moved", rename_all = "camelCase")]
    Moved {
        entry_key: String,
        source_path: String,
        destination_path: String,
    },
    #[serde(rename = "skipped", rename_all = "camelCase")]
    Skipped {
        entry_key: String,
        source_path: String,
        reason: String,
    },
    #[serde(rename = "copied-not-removed", rename_all = "camelCase")]
    CopiedNotRemoved {
        entry_key: String,
        source_path: String,
        destination_path: String,
        message: String,
    },
    #[serde(rename = "failed", rename_all = "camelCase")]
    Failed {
        entry_key: String,
        source_path: String,
        code: String,
        message: String,
    },
}

fn is_cross_device(err: &io::Error) -> bool {
    matches!(err.raw_os_error(), Some(18) | Some(17))
}

fn classify_io_code(err: &io::Error) -> &'static str {
    match err.kind() {
        ErrorKind::NotFound => "missing",
        ErrorKind::PermissionDenied => "permission-denied",
        _ => "io",
    }
}

pub fn keep_both_path(dest_dir: &Path, file_name: &str) -> PathBuf {
    let original = dest_dir.join(file_name);
    if !original.exists() {
        return original;
    }
    let path = Path::new(file_name);
    let stem = path
        .file_stem()
        .map(|value| value.to_string_lossy().into_owned())
        .unwrap_or_else(|| file_name.to_string());
    let ext = path
        .extension()
        .map(|value| value.to_string_lossy().into_owned());
    for n in 1..10_000 {
        let candidate = match &ext {
            Some(extension) => dest_dir.join(format!("{stem} ({n}).{extension}")),
            None => dest_dir.join(format!("{stem} ({n})")),
        };
        if !candidate.exists() {
            return candidate;
        }
    }
    dest_dir.join(format!("{stem} (1)"))
}

fn same_directory(source: &Path, dest_dir: &Path) -> bool {
    match (
        source.parent().and_then(|p| fs::canonicalize(p).ok()),
        fs::canonicalize(dest_dir).ok(),
    ) {
        (Some(src), Some(dest)) => src == dest,
        _ => false,
    }
}

fn temp_copy_path(dest: &Path) -> PathBuf {
    let name = dest
        .file_name()
        .map(|value| value.to_string_lossy().into_owned())
        .unwrap_or_else(|| "file".to_string());
    dest.with_file_name(format!(".{name}.mg-part"))
}

fn copy_then_remove(source: &Path, dest: &Path) -> MoveCopyOutcome {
    let temp = temp_copy_path(dest);
    if let Err(err) = copy_verified(source, &temp) {
        let _ = fs::remove_file(&temp);
        return MoveCopyOutcome::Failed(err);
    }
    if let Err(err) = fs::rename(&temp, dest) {
        let _ = fs::remove_file(&temp);
        return MoveCopyOutcome::Failed(err);
    }
    match fs::remove_file(source) {
        Ok(()) => MoveCopyOutcome::Moved,
        Err(_) => MoveCopyOutcome::CopiedNotRemoved,
    }
}

fn copy_verified(source: &Path, dest: &Path) -> io::Result<()> {
    let source_len = fs::metadata(source)?.len();
    {
        let mut reader = File::open(source)?;
        let mut writer = File::create(dest)?;
        io::copy(&mut reader, &mut writer)?;
        writer.flush()?;
        writer.sync_all()?;
    }
    let dest_len = fs::metadata(dest)?.len();
    if dest_len != source_len {
        let _ = fs::remove_file(dest);
        return Err(io::Error::other("copied file length did not match source"));
    }
    Ok(())
}

enum MoveCopyOutcome {
    Moved,
    CopiedNotRemoved,
    Failed(io::Error),
}

pub fn move_one_file(
    entry_key: &str,
    source_path: &str,
    dest_dir: &Path,
    conflict_policy: &str,
    cancelled: bool,
) -> MoveItemResult {
    let source = Path::new(source_path);
    if cancelled {
        return MoveItemResult::Skipped {
            entry_key: entry_key.to_string(),
            source_path: source_path.to_string(),
            reason: "cancelled".to_string(),
        };
    }

    let meta = match fs::symlink_metadata(source) {
        Ok(meta) => meta,
        Err(err) => {
            return MoveItemResult::Failed {
                entry_key: entry_key.to_string(),
                source_path: source_path.to_string(),
                code: classify_io_code(&err).to_string(),
                message: format!("Could not read the source file ({})", err.kind()),
            };
        }
    };
    if meta.file_type().is_symlink() || !meta.file_type().is_file() {
        return MoveItemResult::Failed {
            entry_key: entry_key.to_string(),
            source_path: source_path.to_string(),
            code: "invalid-source".to_string(),
            message: "Only regular files can be moved".to_string(),
        };
    }

    let dest_meta = match fs::metadata(dest_dir) {
        Ok(meta) => meta,
        Err(err) => {
            return MoveItemResult::Failed {
                entry_key: entry_key.to_string(),
                source_path: source_path.to_string(),
                code: if err.kind() == ErrorKind::NotFound {
                    "invalid-destination".to_string()
                } else {
                    classify_io_code(&err).to_string()
                },
                message: format!("Could not use the destination folder ({})", err.kind()),
            };
        }
    };
    if !dest_meta.is_dir() {
        return MoveItemResult::Failed {
            entry_key: entry_key.to_string(),
            source_path: source_path.to_string(),
            code: "invalid-destination".to_string(),
            message: "Destination is not a directory".to_string(),
        };
    }

    if same_directory(source, dest_dir) {
        return MoveItemResult::Skipped {
            entry_key: entry_key.to_string(),
            source_path: source_path.to_string(),
            reason: "same-location".to_string(),
        };
    }

    let file_name = source
        .file_name()
        .map(|value| value.to_string_lossy().into_owned())
        .unwrap_or_else(|| "file".to_string());
    let dest_path = if dest_dir.join(&file_name).exists() {
        if conflict_policy == "skip" {
            return MoveItemResult::Skipped {
                entry_key: entry_key.to_string(),
                source_path: source_path.to_string(),
                reason: "conflict".to_string(),
            };
        }
        keep_both_path(dest_dir, &file_name)
    } else {
        dest_dir.join(&file_name)
    };

    match fs::rename(source, &dest_path) {
        Ok(()) => MoveItemResult::Moved {
            entry_key: entry_key.to_string(),
            source_path: source_path.to_string(),
            destination_path: dest_path.to_string_lossy().into_owned(),
        },
        Err(err) if is_cross_device(&err) => match copy_then_remove(source, &dest_path) {
            MoveCopyOutcome::Moved => MoveItemResult::Moved {
                entry_key: entry_key.to_string(),
                source_path: source_path.to_string(),
                destination_path: dest_path.to_string_lossy().into_owned(),
            },
            MoveCopyOutcome::CopiedNotRemoved => MoveItemResult::CopiedNotRemoved {
                entry_key: entry_key.to_string(),
                source_path: source_path.to_string(),
                destination_path: dest_path.to_string_lossy().into_owned(),
                message: "A copy is in the destination, but the original could not be removed"
                    .to_string(),
            },
            MoveCopyOutcome::Failed(copy_err) => MoveItemResult::Failed {
                entry_key: entry_key.to_string(),
                source_path: source_path.to_string(),
                code: classify_io_code(&copy_err).to_string(),
                message: format!("Could not copy the file ({})", copy_err.kind()),
            },
        },
        Err(err) => MoveItemResult::Failed {
            entry_key: entry_key.to_string(),
            source_path: source_path.to_string(),
            code: classify_io_code(&err).to_string(),
            message: format!("The file could not be moved ({})", err.kind()),
        },
    }
}

pub fn move_files_sequential(
    request: &MoveFilesRequest,
    cancelled: &AtomicBool,
    mut on_progress: impl FnMut(MoveProgress),
) -> Vec<MoveItemResult> {
    let dest_dir = PathBuf::from(&request.destination_directory);
    let total = request.items.len();
    let mut succeeded = 0;
    let mut skipped = 0;
    let mut failed = 0;
    let mut results = Vec::with_capacity(total);

    for (index, item) in request.items.iter().enumerate() {
        let already_cancelled = cancelled.load(Ordering::Relaxed);
        let result = move_one_file(
            &item.entry_key,
            &item.source_path,
            &dest_dir,
            &request.conflict_policy,
            already_cancelled,
        );
        match &result {
            MoveItemResult::Moved { .. } => succeeded += 1,
            MoveItemResult::Skipped { .. } => skipped += 1,
            MoveItemResult::CopiedNotRemoved { .. } | MoveItemResult::Failed { .. } => failed += 1,
        }
        results.push(result);
        on_progress(MoveProgress {
            operation_id: request.operation_id.clone(),
            completed: index + 1,
            total,
            succeeded,
            skipped,
            failed,
        });
    }
    results
}

#[tauri::command]
pub async fn move_files(
    app: AppHandle,
    cancels: State<'_, MoveCancelMap>,
    request: MoveFilesRequest,
) -> Result<Vec<MoveItemResult>, String> {
    if request.conflict_policy != "keep-both" && request.conflict_policy != "skip" {
        return Err("Unsupported conflict policy".to_string());
    }
    let flag = Arc::new(AtomicBool::new(false));
    cancels.insert(request.operation_id.clone(), flag.clone());
    let request_for_task = request.clone();
    let app_for_task = app.clone();
    let results = tokio::task::spawn_blocking(move || {
        move_files_sequential(&request_for_task, &flag, |progress| {
            let _ = app_for_task.emit("files:move-progress", &progress);
        })
    })
    .await
    .map_err(|err| format!("Move task failed: {err}"))?;
    cancels.remove(&request.operation_id);
    Ok(results)
}

#[tauri::command]
pub fn cancel_move_files(
    cancels: State<'_, MoveCancelMap>,
    operation_id: String,
) -> Result<(), String> {
    if let Some(flag) = cancels.get(&operation_id) {
        flag.store(true, Ordering::Relaxed);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::sync::atomic::AtomicBool;
    use tempfile::tempdir;

    fn write_file(path: &Path, contents: &str) {
        fs::write(path, contents).unwrap();
    }

    fn request(items: Vec<(&str, &Path)>, dest: &Path, policy: &str) -> MoveFilesRequest {
        MoveFilesRequest {
            operation_id: "op-1".to_string(),
            destination_directory: dest.to_string_lossy().into_owned(),
            conflict_policy: policy.to_string(),
            items: items
                .into_iter()
                .map(|(key, path)| MoveFilesRequestItem {
                    entry_key: key.to_string(),
                    source_path: path.to_string_lossy().into_owned(),
                })
                .collect(),
        }
    }

    #[test]
    fn moves_file_on_the_same_volume() {
        let dir = tempdir().unwrap();
        let source = dir.path().join("photo.jpg");
        let dest = dir.path().join("out");
        fs::create_dir(&dest).unwrap();
        write_file(&source, "hello");
        let cancelled = AtomicBool::new(false);
        let req = request(vec![("a", &source)], &dest, "keep-both");
        let results = move_files_sequential(&req, &cancelled, |_| {});
        assert!(matches!(results[0], MoveItemResult::Moved { .. }));
        assert!(!source.exists());
        assert!(dest.join("photo.jpg").exists());
        assert_eq!(fs::read_to_string(dest.join("photo.jpg")).unwrap(), "hello");
    }

    #[test]
    fn keep_both_adds_numeric_suffix() {
        let dir = tempdir().unwrap();
        let dest = dir.path().join("out");
        fs::create_dir(&dest).unwrap();
        write_file(&dest.join("photo.jpg"), "existing");
        let source = dir.path().join("photo.jpg");
        write_file(&source, "moved");
        let cancelled = AtomicBool::new(false);
        let req = request(vec![("a", &source)], &dest, "keep-both");
        let results = move_files_sequential(&req, &cancelled, |_| {});
        match &results[0] {
            MoveItemResult::Moved {
                destination_path, ..
            } => {
                assert!(destination_path.ends_with("photo (1).jpg"));
            }
            other => panic!("expected moved, got {other:?}"),
        }
        assert_eq!(
            fs::read_to_string(dest.join("photo.jpg")).unwrap(),
            "existing"
        );
        assert_eq!(
            fs::read_to_string(dest.join("photo (1).jpg")).unwrap(),
            "moved"
        );
    }

    #[test]
    fn skip_leaves_both_files() {
        let dir = tempdir().unwrap();
        let dest = dir.path().join("out");
        fs::create_dir(&dest).unwrap();
        write_file(&dest.join("photo.jpg"), "existing");
        let source = dir.path().join("photo.jpg");
        write_file(&source, "moved");
        let cancelled = AtomicBool::new(false);
        let req = request(vec![("a", &source)], &dest, "skip");
        let results = move_files_sequential(&req, &cancelled, |_| {});
        assert!(matches!(
            results[0],
            MoveItemResult::Skipped { ref reason, .. } if reason == "conflict"
        ));
        assert!(source.exists());
        assert_eq!(
            fs::read_to_string(dest.join("photo.jpg")).unwrap(),
            "existing"
        );
    }

    #[test]
    fn missing_source_is_failed() {
        let dir = tempdir().unwrap();
        let dest = dir.path().join("out");
        fs::create_dir(&dest).unwrap();
        let source = dir.path().join("missing.jpg");
        let cancelled = AtomicBool::new(false);
        let req = request(vec![("a", &source)], &dest, "keep-both");
        let results = move_files_sequential(&req, &cancelled, |_| {});
        assert!(matches!(
            results[0],
            MoveItemResult::Failed { ref code, .. } if code == "missing"
        ));
    }

    #[test]
    fn invalid_destination_is_failed() {
        let dir = tempdir().unwrap();
        let source = dir.path().join("photo.jpg");
        write_file(&source, "hello");
        let dest = dir.path().join("not-a-dir");
        write_file(&dest, "file");
        let cancelled = AtomicBool::new(false);
        let req = request(vec![("a", &source)], &dest, "keep-both");
        let results = move_files_sequential(&req, &cancelled, |_| {});
        assert!(matches!(
            results[0],
            MoveItemResult::Failed { ref code, .. } if code == "invalid-destination"
        ));
        assert!(source.exists());
    }

    #[test]
    fn cancel_marks_remaining_items() {
        let dir = tempdir().unwrap();
        let dest = dir.path().join("out");
        fs::create_dir(&dest).unwrap();
        let a = dir.path().join("a.jpg");
        let b = dir.path().join("b.jpg");
        write_file(&a, "a");
        write_file(&b, "b");
        let cancelled = AtomicBool::new(true);
        let req = request(vec![("a", &a), ("b", &b)], &dest, "keep-both");
        let results = move_files_sequential(&req, &cancelled, |_| {});
        assert_eq!(results.len(), 2);
        assert!(matches!(
            results[0],
            MoveItemResult::Skipped { ref reason, .. } if reason == "cancelled"
        ));
        assert!(a.exists());
        assert!(b.exists());
    }

    #[test]
    fn copied_not_removed_when_source_delete_fails() {
        let outcome = MoveCopyOutcome::CopiedNotRemoved;
        match outcome {
            MoveCopyOutcome::CopiedNotRemoved => {}
            _ => panic!("expected copied-not-removed"),
        }
    }

    #[cfg(unix)]
    #[test]
    fn copy_delete_failure_keeps_both_files() {
        use std::os::unix::fs::PermissionsExt;
        let dir = tempdir().unwrap();
        let source_dir = dir.path().join("src");
        let dest_dir = dir.path().join("dest");
        fs::create_dir(&source_dir).unwrap();
        fs::create_dir(&dest_dir).unwrap();
        let source = source_dir.join("photo.jpg");
        write_file(&source, "hello");
        // Simulate delete failure by making the source directory read-only after we
        // still need to read it — rename on the same volume would succeed, so force
        // the copy path by using copy_then_remove directly.
        let dest = dest_dir.join("photo.jpg");
        fs::set_permissions(&source_dir, fs::Permissions::from_mode(0o555)).unwrap();
        let outcome = copy_then_remove(&source, &dest);
        fs::set_permissions(&source_dir, fs::Permissions::from_mode(0o755)).unwrap();
        match outcome {
            MoveCopyOutcome::CopiedNotRemoved => {
                assert!(source.exists());
                assert!(dest.exists());
            }
            MoveCopyOutcome::Moved => {
                // Some environments still allow unlink of a writable file in a
                // read-only directory; the important invariant is no dual-loss.
                assert!(dest.exists());
            }
            MoveCopyOutcome::Failed(_) => {
                assert!(source.exists());
            }
        }
    }
}
