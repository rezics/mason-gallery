use crate::archive::is_archive_extension;
use serde::Serialize;
use std::io;
use std::path::Path;

/// Keep archive suffixes in sync with `packages/core/src/lib/archiveFormats.ts`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum DroppedSource {
    Folder { locator: String, label: String },
    Archive { locator: String, label: String },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum DropRejectionReason {
    UnsupportedType,
    /// Web-only: archives cannot be opened in the browser yet.
    #[allow(dead_code)]
    UnsupportedPlatform,
    Missing,
    PermissionDenied,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DropRejection {
    pub label: String,
    pub reason: DropRejectionReason,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DropBatch {
    pub accepted: Vec<DroppedSource>,
    pub rejected: Vec<DropRejection>,
}

fn source_label(path: &Path, fallback: &str) -> String {
    path.file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or(fallback)
        .to_string()
}

fn classify_io_error(err: &io::Error) -> DropRejectionReason {
    match err.kind() {
        io::ErrorKind::PermissionDenied => DropRejectionReason::PermissionDenied,
        _ => DropRejectionReason::Missing,
    }
}

pub fn classify_paths(paths: &[String]) -> DropBatch {
    let mut accepted = Vec::new();
    let mut rejected = Vec::new();

    for locator in paths {
        let path = Path::new(locator);
        let label = source_label(path, locator);
        match std::fs::metadata(path) {
            Ok(metadata) if metadata.is_dir() => {
                accepted.push(DroppedSource::Folder {
                    locator: locator.clone(),
                    label,
                });
            }
            Ok(metadata) if metadata.is_file() => {
                let extension = path
                    .extension()
                    .and_then(|value| value.to_str())
                    .unwrap_or("");
                if is_archive_extension(extension) {
                    accepted.push(DroppedSource::Archive {
                        locator: locator.clone(),
                        label,
                    });
                } else {
                    rejected.push(DropRejection {
                        label,
                        reason: DropRejectionReason::UnsupportedType,
                    });
                }
            }
            Ok(_) => rejected.push(DropRejection {
                label,
                reason: DropRejectionReason::UnsupportedType,
            }),
            Err(error) => rejected.push(DropRejection {
                label,
                reason: classify_io_error(&error),
            }),
        }
    }

    DropBatch { accepted, rejected }
}

#[tauri::command]
pub fn classify_drop_paths(paths: Vec<String>) -> DropBatch {
    classify_paths(&paths)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn classifies_directories_as_folders_without_using_the_name() {
        let root = tempdir().unwrap();
        let folder = root.path().join("looks-like.zip");
        fs::create_dir(&folder).unwrap();

        let batch = classify_paths(&[folder.to_string_lossy().into_owned()]);
        assert_eq!(batch.rejected.len(), 0);
        assert!(matches!(
            batch.accepted.as_slice(),
            [DroppedSource::Folder { label, .. }] if label == "looks-like.zip"
        ));
    }

    #[test]
    fn accepts_archive_files_and_rejects_other_files() {
        let root = tempdir().unwrap();
        let archive = root.path().join("pack.cbz");
        let image = root.path().join("photo.jpg");
        fs::write(&archive, b"not a real archive").unwrap();
        fs::write(&image, b"not an image").unwrap();

        let batch = classify_paths(&[
            archive.to_string_lossy().into_owned(),
            image.to_string_lossy().into_owned(),
        ]);
        assert!(matches!(
            batch.accepted.as_slice(),
            [DroppedSource::Archive { label, .. }] if label == "pack.cbz"
        ));
        assert_eq!(
            batch.rejected,
            vec![DropRejection {
                label: "photo.jpg".into(),
                reason: DropRejectionReason::UnsupportedType,
            }]
        );
    }

    #[test]
    fn reports_missing_paths() {
        let batch = classify_paths(&["/definitely/missing/gallery-source".into()]);
        assert_eq!(batch.accepted.len(), 0);
        assert_eq!(batch.rejected[0].reason, DropRejectionReason::Missing);
    }
}
