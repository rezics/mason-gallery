use crate::drop::{classify_paths, DropBatch};
use std::ffi::OsString;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

const SHELL_OPEN_ARGUMENT: &str = "--shell-open";
const OPEN_PENDING_EVENT: &str = "shell-open:pending";

#[derive(Default)]
pub struct ExternalOpenQueue {
    pending_paths: Mutex<Vec<String>>,
}

pub fn paths_from_args(args: &[String]) -> Vec<String> {
    let Some(marker) = args
        .iter()
        .position(|argument| argument == SHELL_OPEN_ARGUMENT)
    else {
        return Vec::new();
    };
    args[(marker + 1)..]
        .iter()
        .filter(|argument| argument.as_str() != "--")
        .cloned()
        .collect()
}

pub fn paths_from_os_args(args: impl IntoIterator<Item = OsString>) -> Vec<String> {
    let utf8_args = args
        .into_iter()
        .filter_map(|argument| argument.into_string().ok())
        .collect::<Vec<_>>();
    paths_from_args(&utf8_args)
}

pub fn enqueue_paths(app: &AppHandle, paths: Vec<String>) {
    if paths.is_empty() {
        return;
    }
    let queue = app.state::<ExternalOpenQueue>();
    queue
        .pending_paths
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
        .extend(paths);
    let _ = app.emit(OPEN_PENDING_EVENT, ());
}

#[tauri::command]
pub fn take_pending_open_sources(queue: State<'_, ExternalOpenQueue>) -> DropBatch {
    let paths = queue
        .pending_paths
        .lock()
        .map(|mut pending| std::mem::take(&mut *pending))
        .unwrap_or_else(|poisoned| std::mem::take(&mut *poisoned.into_inner()));
    classify_paths(&paths)
}

#[cfg(target_os = "macos")]
pub fn paths_from_urls(urls: Vec<tauri::Url>) -> Vec<String> {
    urls.into_iter()
        .filter_map(|url| url.to_file_path().ok())
        .filter_map(|path| path.to_str().map(str::to_owned))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_accepts_arguments_after_the_explicit_shell_marker() {
        let args = vec![
            "mason-gallery".to_string(),
            "--verbose".to_string(),
            SHELL_OPEN_ARGUMENT.to_string(),
            "D:\\Pictures".to_string(),
            "D:\\Books\\volume.cbz".to_string(),
        ];
        assert_eq!(
            paths_from_args(&args),
            vec!["D:\\Pictures", "D:\\Books\\volume.cbz"]
        );
    }

    #[test]
    fn ignores_regular_application_arguments() {
        assert!(paths_from_args(&["mason-gallery".into(), "--verbose".into()]).is_empty());
    }
}
