mod commands;
mod server;

use server::AllowedRoots;
use std::collections::HashSet;
use std::sync::{Arc, RwLock};
use tauri::Manager;

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

            let roots_clone = allowed_roots.clone();
            let port = tauri::async_runtime::block_on(server::start_server(roots_clone))
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
