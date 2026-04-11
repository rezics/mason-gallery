mod archive;
mod archive_commands;
mod commands;
mod database;
mod password;
mod server;

use database::Database;
use server::AllowedRoots;
use std::collections::HashSet;
use std::sync::{Arc, RwLock};
use std::path::PathBuf;
use tauri::Manager;

pub struct CacheDir(pub PathBuf);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::default().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _: Result<(), tauri::Error> = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_persisted_scope::init())
        .setup(|app| {
            let allowed_roots: AllowedRoots = Arc::new(RwLock::new(HashSet::new()));

            // Initialize database
            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("Failed to get app data dir: {}", e))?;
            let db = Database::new(&app_data_dir)
                .map_err(|e| format!("Failed to initialize database: {}", e))?;
            let db = Arc::new(db);
            app.manage(db.clone());

            // Cache directory for thumbnails and extracted files
            let cache_dir = app_data_dir.join("archive-cache");
            std::fs::create_dir_all(&cache_dir)
                .map_err(|e| format!("Failed to create cache dir: {}", e))?;
            app.manage(CacheDir(cache_dir.clone()));

            // In-memory password cache
            app.manage(password::PasswordCache::new());

            // Add cache dir as allowed root for the image server
            {
                let mut roots = allowed_roots.write().unwrap();
                if let Ok(canonical) = std::fs::canonicalize(&cache_dir) {
                    roots.insert(canonical);
                } else {
                    roots.insert(cache_dir.clone());
                }
            }

            let roots_clone = allowed_roots.clone();
            let port = tauri::async_runtime::block_on(server::start_server(
                roots_clone,
                cache_dir,
            ))
            .map_err(|e| e.to_string())?;

            app.manage(server::ServerState {
                port,
                allowed_roots,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::scan_directory,
            commands::list_directory_tree,
            commands::delete_to_trash,
            commands::open_devtools,
            commands::get_image_server_port,
            archive_commands::scan_archive,
            archive_commands::extract_archive_entry,
            archive_commands::get_archive_info,
            archive_commands::get_cache_stats,
            archive_commands::clear_cache,
            archive_commands::pin_cache,
            archive_commands::unlock_archive,
            archive_commands::check_migration,
            archive_commands::confirm_migration,
            archive_commands::startup_cache_cleanup,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
