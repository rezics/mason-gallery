use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum DesktopPlatform {
    #[cfg(windows)]
    Windows,
    #[cfg(target_os = "macos")]
    Macos,
    #[cfg(target_os = "linux")]
    Linux,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum RegistrationState {
    #[cfg(any(windows, target_os = "linux"))]
    Enabled,
    #[cfg(any(windows, target_os = "linux"))]
    Disabled,
    #[cfg(any(windows, target_os = "linux"))]
    NeedsRepair,
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    Managed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IntegrationTargetStatus {
    pub state: RegistrationState,
    pub configurable: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemIntegrationStatus {
    pub platform: DesktopPlatform,
    pub folders: IntegrationTargetStatus,
    pub archives: IntegrationTargetStatus,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemIntegrationSelection {
    pub folders: bool,
    pub archives: bool,
}

#[tauri::command]
pub fn get_system_integration_status() -> Result<SystemIntegrationStatus, String> {
    platform::status()
}

#[tauri::command]
pub fn set_system_integration(
    selection: SystemIntegrationSelection,
) -> Result<SystemIntegrationStatus, String> {
    platform::set(selection)
}

#[cfg(windows)]
mod platform {
    use super::*;
    use std::io;
    use std::path::Path;
    use std::ptr;
    use windows_sys::Win32::UI::Shell::{SHChangeNotify, SHCNE_ASSOCCHANGED, SHCNF_IDLIST};
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    const CLASSES: &str = r"Software\Classes";
    const VERB_NAME: &str = "MasonGallery";
    const ARCHIVE_EXTENSIONS: [&str; 5] = [".zip", ".rar", ".7z", ".cbz", ".cbr"];

    struct ExpectedValue {
        key: String,
        name: &'static str,
        value: String,
    }

    fn current_executable() -> Result<String, String> {
        let path = std::env::current_exe()
            .map_err(|error| format!("Unable to locate the MasonGallery executable: {error}"))?;
        path.to_str()
            .map(str::to_owned)
            .ok_or_else(|| "The MasonGallery executable path is not valid Unicode".to_string())
    }

    fn quoted_command(executable: &str, argument: &str) -> String {
        format!(r#""{executable}" --shell-open "{argument}""#)
    }

    fn icon_value(executable: &str) -> String {
        format!(r#""{executable}",0"#)
    }

    fn folder_roots() -> [String; 2] {
        [
            format!(r"{CLASSES}\Directory\shell\{VERB_NAME}"),
            format!(r"{CLASSES}\Directory\Background\shell\{VERB_NAME}"),
        ]
    }

    fn archive_roots() -> Vec<String> {
        ARCHIVE_EXTENSIONS
            .iter()
            .map(|extension| {
                format!(r"{CLASSES}\SystemFileAssociations\{extension}\shell\{VERB_NAME}")
            })
            .collect()
    }

    fn application_root() -> String {
        format!(r"{CLASSES}\Applications\{}.exe", env!("CARGO_PKG_NAME"))
    }

    fn folder_expectations(executable: &str) -> Vec<ExpectedValue> {
        let [directory, background] = folder_roots();
        vec![
            ExpectedValue {
                key: directory.clone(),
                name: "Icon",
                value: icon_value(executable),
            },
            ExpectedValue {
                key: format!(r"{directory}\command"),
                name: "",
                value: quoted_command(executable, "%1"),
            },
            ExpectedValue {
                key: background.clone(),
                name: "Icon",
                value: icon_value(executable),
            },
            ExpectedValue {
                key: format!(r"{background}\command"),
                name: "",
                value: quoted_command(executable, "%V"),
            },
        ]
    }

    fn archive_expectations(executable: &str) -> Vec<ExpectedValue> {
        let mut expected = Vec::new();
        for root in archive_roots() {
            expected.push(ExpectedValue {
                key: root.clone(),
                name: "Icon",
                value: icon_value(executable),
            });
            expected.push(ExpectedValue {
                key: format!(r"{root}\command"),
                name: "",
                value: quoted_command(executable, "%1"),
            });
        }

        let application = application_root();
        expected.push(ExpectedValue {
            key: format!(r"{application}\shell\open\command"),
            name: "",
            value: quoted_command(executable, "%1"),
        });
        for extension in ARCHIVE_EXTENSIONS {
            expected.push(ExpectedValue {
                key: format!(r"{application}\SupportedTypes"),
                name: extension,
                value: String::new(),
            });
        }
        expected
    }

    fn root_exists(root: &RegKey, path: &str) -> bool {
        root.open_subkey(path).is_ok()
    }

    fn value_matches(root: &RegKey, expected: &ExpectedValue) -> bool {
        root.open_subkey(&expected.key)
            .ok()
            .and_then(|key| key.get_value::<String, _>(expected.name).ok())
            .is_some_and(|value| value == expected.value)
    }

    fn inspect(
        root: &RegKey,
        owned_roots: impl IntoIterator<Item = String>,
        expected: &[ExpectedValue],
    ) -> RegistrationState {
        let any_present = owned_roots.into_iter().any(|path| root_exists(root, &path));
        if !any_present {
            return RegistrationState::Disabled;
        }
        if expected.iter().all(|value| value_matches(root, value)) {
            RegistrationState::Enabled
        } else {
            RegistrationState::NeedsRepair
        }
    }

    fn write_value(root: &RegKey, expected: &ExpectedValue) -> Result<(), String> {
        let (key, _) = root
            .create_subkey(&expected.key)
            .map_err(|error| format!("Unable to create registry key {}: {error}", expected.key))?;
        key.set_value(expected.name, &expected.value)
            .map_err(|error| format!("Unable to update registry key {}: {error}", expected.key))
    }

    fn remove_owned_key(root: &RegKey, path: &str) -> Result<(), String> {
        match root.delete_subkey_all(path) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
            Err(error) => Err(format!("Unable to remove registry key {path}: {error}")),
        }
    }

    fn write_folders(root: &RegKey, executable: &str, enabled: bool) -> Result<(), String> {
        if enabled {
            for base in folder_roots() {
                let (key, _) = root
                    .create_subkey(&base)
                    .map_err(|error| format!("Unable to create registry key {base}: {error}"))?;
                key.set_value("", &"Open with MasonGallery")
                    .map_err(|error| format!("Unable to update registry key {base}: {error}"))?;
            }
            for expected in folder_expectations(executable) {
                write_value(root, &expected)?;
            }
        } else {
            for base in folder_roots() {
                remove_owned_key(root, &base)?;
            }
        }
        Ok(())
    }

    fn write_archives(root: &RegKey, executable: &str, enabled: bool) -> Result<(), String> {
        if enabled {
            for base in archive_roots() {
                let (key, _) = root
                    .create_subkey(&base)
                    .map_err(|error| format!("Unable to create registry key {base}: {error}"))?;
                key.set_value("", &"Open with MasonGallery")
                    .map_err(|error| format!("Unable to update registry key {base}: {error}"))?;
            }
            let application = application_root();
            let (key, _) = root
                .create_subkey(&application)
                .map_err(|error| format!("Unable to create registry key {application}: {error}"))?;
            key.set_value("FriendlyAppName", &"MasonGallery")
                .map_err(|error| format!("Unable to update registry key {application}: {error}"))?;
            for expected in archive_expectations(executable) {
                write_value(root, &expected)?;
            }
        } else {
            for base in archive_roots() {
                remove_owned_key(root, &base)?;
            }
            remove_owned_key(root, &application_root())?;
        }
        Ok(())
    }

    fn notify_shell() {
        // SAFETY: SHChangeNotify accepts null item pointers for the global
        // association-changed event and does not retain either pointer.
        unsafe {
            SHChangeNotify(
                SHCNE_ASSOCCHANGED as i32,
                SHCNF_IDLIST,
                ptr::null(),
                ptr::null(),
            );
        }
    }

    pub fn status() -> Result<SystemIntegrationStatus, String> {
        let executable = current_executable()?;
        let root = RegKey::predef(HKEY_CURRENT_USER);
        let folder_state = inspect(&root, folder_roots(), &folder_expectations(&executable));
        let mut archive_owned_roots = archive_roots();
        archive_owned_roots.push(application_root());
        let archive_state = inspect(
            &root,
            archive_owned_roots,
            &archive_expectations(&executable),
        );
        Ok(SystemIntegrationStatus {
            platform: DesktopPlatform::Windows,
            folders: IntegrationTargetStatus {
                state: folder_state,
                configurable: true,
            },
            archives: IntegrationTargetStatus {
                state: archive_state,
                configurable: true,
            },
        })
    }

    pub fn set(selection: SystemIntegrationSelection) -> Result<SystemIntegrationStatus, String> {
        let executable = current_executable()?;
        if !Path::new(&executable).is_file() {
            return Err("The MasonGallery executable no longer exists".to_string());
        }
        let root = RegKey::predef(HKEY_CURRENT_USER);
        write_folders(&root, &executable, selection.folders)?;
        write_archives(&root, &executable, selection.archives)?;
        notify_shell();
        status()
    }
}

#[cfg(target_os = "macos")]
mod platform {
    use super::*;

    pub fn status() -> Result<SystemIntegrationStatus, String> {
        let managed = IntegrationTargetStatus {
            state: RegistrationState::Managed,
            configurable: false,
        };
        Ok(SystemIntegrationStatus {
            platform: DesktopPlatform::Macos,
            folders: managed,
            archives: managed,
        })
    }

    pub fn set(_selection: SystemIntegrationSelection) -> Result<SystemIntegrationStatus, String> {
        Err("macOS file support is declared by the signed application bundle".to_string())
    }
}

#[cfg(target_os = "linux")]
mod platform {
    use super::*;
    use std::collections::HashSet;
    use std::env;
    use std::fs;
    use std::io::Write;
    use std::os::unix::fs::PermissionsExt;
    use std::path::{Path, PathBuf};
    use std::process::Command;
    use tauri::utils::{config::BundleType, platform::bundle_type};

    const DESKTOP_FILE_NAME: &str = "com.mason-gallery.app.desktop";
    const FOLDER_MIME_TYPES: [&str; 1] = ["inode/directory"];
    const ARCHIVE_MIME_TYPES: [&str; 10] = [
        "application/zip",
        "application/x-zip-compressed",
        "application/vnd.rar",
        "application/x-rar",
        "application/x-rar-compressed",
        "application/x-7z-compressed",
        "application/vnd.comicbook+zip",
        "application/vnd.comicbook-rar",
        "application/x-cbz",
        "application/x-cbr",
    ];

    fn appimage_path() -> Result<PathBuf, String> {
        let value = env::var_os("APPIMAGE")
            .ok_or_else(|| "The AppImage launch path is unavailable".to_string())?;
        let path = PathBuf::from(value);
        if !path.is_file() {
            return Err("The APPIMAGE environment variable does not point to a file".to_string());
        }
        Ok(path)
    }

    fn applications_dir() -> Result<PathBuf, String> {
        if let Some(value) = env::var_os("XDG_DATA_HOME") {
            return Ok(PathBuf::from(value).join("applications"));
        }
        let home = env::var_os("HOME")
            .ok_or_else(|| "Neither XDG_DATA_HOME nor HOME is available".to_string())?;
        Ok(PathBuf::from(home).join(".local/share/applications"))
    }

    fn desktop_file_path() -> Result<PathBuf, String> {
        Ok(applications_dir()?.join(DESKTOP_FILE_NAME))
    }

    fn escape_exec_path(path: &Path) -> Result<String, String> {
        let value = path
            .to_str()
            .ok_or_else(|| "The AppImage path is not valid Unicode".to_string())?;
        if value.contains(['\n', '\r', '\0']) {
            return Err(
                "The AppImage path contains characters unsupported by desktop files".into(),
            );
        }
        let escaped = value
            .replace('\\', "\\\\")
            .replace('"', "\\\"")
            .replace('`', "\\`")
            .replace('$', "\\$");
        Ok(format!("\"{escaped}\""))
    }

    fn desktop_entry(
        appimage: &Path,
        selection: SystemIntegrationSelection,
    ) -> Result<String, String> {
        let mut mime_types = Vec::new();
        if selection.folders {
            mime_types.extend(FOLDER_MIME_TYPES);
        }
        if selection.archives {
            mime_types.extend(ARCHIVE_MIME_TYPES);
        }
        let mime_value = mime_types
            .iter()
            .map(|value| format!("{value};"))
            .collect::<String>();
        Ok(format!(
            "[Desktop Entry]\nType=Application\nName=MasonGallery\nComment=Browse image folders and archives\nExec={} --shell-open %F\nIcon=mason-gallery\nTerminal=false\nCategories=Graphics;Viewer;\nMimeType={}\nX-MasonGallery-Managed=true\n",
            escape_exec_path(appimage)?,
            mime_value
        ))
    }

    fn entry_value<'a>(contents: &'a str, key: &str) -> Option<&'a str> {
        contents.lines().find_map(|line| {
            let (candidate, value) = line.split_once('=')?;
            (candidate == key).then_some(value)
        })
    }

    fn read_desktop_entry(path: &Path) -> Result<Option<String>, String> {
        match fs::read_to_string(path) {
            Ok(contents) => Ok(Some(contents)),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(error) => Err(format!(
                "Unable to read desktop integration file {}: {error}",
                path.display()
            )),
        }
    }

    fn validate_entry_ownership(contents: Option<&str>, path: &Path) -> Result<(), String> {
        if contents
            .is_some_and(|value| entry_value(value, "X-MasonGallery-Managed") != Some("true"))
        {
            return Err(format!(
                "Desktop integration file is not owned by MasonGallery: {}",
                path.display()
            ));
        }
        Ok(())
    }

    fn target_state(
        contents: Option<&str>,
        expected_exec: &str,
        required_mime_types: &[&str],
    ) -> RegistrationState {
        let Some(contents) = contents else {
            return RegistrationState::Disabled;
        };
        let mime_types: HashSet<&str> = entry_value(contents, "MimeType")
            .unwrap_or_default()
            .split(';')
            .filter(|value| !value.is_empty())
            .collect();
        let present = required_mime_types
            .iter()
            .filter(|value| mime_types.contains(**value))
            .count();
        if present == 0 {
            return RegistrationState::Disabled;
        }
        let valid_owner = entry_value(contents, "X-MasonGallery-Managed") == Some("true");
        let valid_exec = entry_value(contents, "Exec") == Some(expected_exec);
        if present == required_mime_types.len() && valid_owner && valid_exec {
            RegistrationState::Enabled
        } else {
            RegistrationState::NeedsRepair
        }
    }

    fn refresh_desktop_database(directory: &Path) {
        let _ = Command::new("update-desktop-database")
            .arg(directory)
            .status();
    }

    fn configurable_status(appimage: &Path) -> Result<SystemIntegrationStatus, String> {
        let path = desktop_file_path()?;
        let contents = read_desktop_entry(&path)?;
        validate_entry_ownership(contents.as_deref(), &path)?;
        let expected_exec = format!("{} --shell-open %F", escape_exec_path(appimage)?);
        Ok(SystemIntegrationStatus {
            platform: DesktopPlatform::Linux,
            folders: IntegrationTargetStatus {
                state: target_state(contents.as_deref(), &expected_exec, &FOLDER_MIME_TYPES),
                configurable: true,
            },
            archives: IntegrationTargetStatus {
                state: target_state(contents.as_deref(), &expected_exec, &ARCHIVE_MIME_TYPES),
                configurable: true,
            },
        })
    }

    pub fn status() -> Result<SystemIntegrationStatus, String> {
        match bundle_type() {
            Some(BundleType::AppImage) => configurable_status(&appimage_path()?),
            Some(BundleType::Deb | BundleType::Rpm) => {
                let managed = IntegrationTargetStatus {
                    state: RegistrationState::Managed,
                    configurable: false,
                };
                Ok(SystemIntegrationStatus {
                    platform: DesktopPlatform::Linux,
                    folders: managed,
                    archives: managed,
                })
            }
            Some(bundle) => Err(format!(
                "The {bundle} bundle type does not support Linux desktop integration"
            )),
            None => Err("Desktop integration is unavailable in an unbundled build".to_string()),
        }
    }

    pub fn set(selection: SystemIntegrationSelection) -> Result<SystemIntegrationStatus, String> {
        if bundle_type() != Some(BundleType::AppImage) {
            return Err("Only AppImage integration can be changed at runtime".to_string());
        }
        let appimage = appimage_path()?;
        let path = desktop_file_path()?;
        let directory = path
            .parent()
            .ok_or_else(|| "Desktop integration path has no parent directory".to_string())?;
        let existing = read_desktop_entry(&path)?;
        validate_entry_ownership(existing.as_deref(), &path)?;
        fs::create_dir_all(directory).map_err(|error| {
            format!(
                "Unable to create desktop integration directory {}: {error}",
                directory.display()
            )
        })?;
        if selection.folders || selection.archives {
            let mut temporary = tempfile::NamedTempFile::new_in(directory).map_err(|error| {
                format!("Unable to create a temporary desktop integration file: {error}")
            })?;
            temporary
                .write_all(desktop_entry(&appimage, selection)?.as_bytes())
                .map_err(|error| format!("Unable to write desktop integration: {error}"))?;
            temporary
                .as_file()
                .set_permissions(fs::Permissions::from_mode(0o644))
                .map_err(|error| {
                    format!("Unable to set desktop integration permissions: {error}")
                })?;
            temporary.persist(&path).map_err(|error| {
                format!(
                    "Unable to install desktop integration file {}: {}",
                    path.display(),
                    error.error
                )
            })?;
        } else {
            match fs::remove_file(&path) {
                Ok(()) => {}
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(error) => {
                    return Err(format!(
                        "Unable to remove desktop integration file {}: {error}",
                        path.display()
                    ))
                }
            }
        }
        refresh_desktop_database(directory);
        configurable_status(&appimage)
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn quotes_appimage_paths_for_desktop_exec() {
            let quoted = escape_exec_path(Path::new("/home/test/Mason Gallery.AppImage")).unwrap();
            assert_eq!(quoted, "\"/home/test/Mason Gallery.AppImage\"");
        }

        #[test]
        fn detects_independent_mime_type_states() {
            let contents = "[Desktop Entry]\nExec=\"/tmp/Mason.AppImage\" --shell-open %F\nMimeType=inode/directory;\nX-MasonGallery-Managed=true\n";
            let expected = "\"/tmp/Mason.AppImage\" --shell-open %F";
            assert_eq!(
                target_state(Some(contents), expected, &FOLDER_MIME_TYPES),
                RegistrationState::Enabled
            );
            assert_eq!(
                target_state(Some(contents), expected, &ARCHIVE_MIME_TYPES),
                RegistrationState::Disabled
            );
        }

        #[test]
        fn refuses_to_replace_unowned_desktop_entries() {
            let path = Path::new("/tmp/com.mason-gallery.app.desktop");
            assert!(validate_entry_ownership(None, path).is_ok());
            assert!(validate_entry_ownership(
                Some("[Desktop Entry]\nX-MasonGallery-Managed=true\n"),
                path
            )
            .is_ok());
            assert!(validate_entry_ownership(Some("[Desktop Entry]\n"), path).is_err());
        }
    }
}

#[cfg(not(any(windows, target_os = "macos", target_os = "linux")))]
mod platform {
    use super::*;

    pub fn status() -> Result<SystemIntegrationStatus, String> {
        Err("System integration is unavailable on this platform".to_string())
    }

    pub fn set(_selection: SystemIntegrationSelection) -> Result<SystemIntegrationStatus, String> {
        Err("System integration is unavailable on this platform".to_string())
    }
}
