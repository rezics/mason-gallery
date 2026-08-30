pub mod archive;
mod archive_commands;
pub mod archive_scan;
pub mod commands;
pub mod database;
mod library_commands;
mod password;
mod server;
pub mod services;
mod settings_commands;

use database::Database;
use server::{AllowedRoots, SharedPolicy};
use services::archive_service::ArchiveService;
use services::image_service::ImageService;
use services::policy::CachePolicy;
use services::source_service::SourceService;
use services::thumbnail_queue::ThumbnailQueue;
use services::thumbnail_service::ThumbnailService;
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use tauri::Manager;

pub struct CacheDir(pub PathBuf);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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

            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("Failed to get app data dir: {}", e))?;
            let stronghold_salt_path = app_data_dir.join("stronghold-salt.txt");
            app.handle().plugin(
                tauri_plugin_stronghold::Builder::with_argon2(&stronghold_salt_path).build(),
            )?;
            let cache_dir = app
                .path()
                .app_cache_dir()
                .map_err(|e| format!("Failed to get app cache dir: {}", e))?
                .join("archive-cache");

            let db = Arc::new(
                Database::new(&app_data_dir, &cache_dir)
                    .map_err(|e| format!("Failed to initialize database: {}", e))?,
            );

            app.manage(db.clone());
            app.manage(CacheDir(cache_dir.clone()));

            // Services
            let archive_svc = Arc::new(ArchiveService::new());
            let source_svc = Arc::new(SourceService::new(db.clone()));
            let thumbnail_svc = Arc::new(ThumbnailService::new(db.clone(), cache_dir.clone()));
            let extract_locks = services::new_extract_locks();
            let password_cache = Arc::new(password::PasswordCache::new());
            app.manage(password_cache.clone());
            let image_svc = Arc::new(ImageService::new(
                db.clone(),
                archive_svc.clone(),
                source_svc.clone(),
                password_cache.clone(),
                extract_locks.clone(),
                cache_dir.clone(),
                allowed_roots.clone(),
            ));
            app.manage(archive_svc.clone());
            app.manage(source_svc.clone());
            app.manage(thumbnail_svc.clone());
            app.manage(image_svc.clone());
            app.manage(extract_locks.clone());

            let policy: SharedPolicy = Arc::new(RwLock::new(CachePolicy::default()));
            app.manage(policy.clone());

            // Thumbnail request queue (LIFO) for lazy folder thumbnails.
            // Concurrency matches the archive scanner's worker count so loose
            // folders aren't artificially gated below archive parallelism.
            let thumb_queue = ThumbnailQueue::new(archive_scan::default_worker_count());
            app.manage(thumb_queue.clone());

            let worker_handle = app.handle().clone();
            let worker_queue = thumb_queue.clone();
            let worker_thumb_svc = thumbnail_svc.clone();
            let worker_source_svc = source_svc.clone();
            let worker_policy = policy.clone();
            tauri::async_runtime::spawn(async move {
                commands::run_thumbnail_worker(
                    worker_handle,
                    worker_queue,
                    worker_thumb_svc,
                    worker_source_svc,
                    worker_policy,
                )
                .await;
            });

            // Cache dir is an allowed root (thumbnail + extracted paths live under it).
            {
                let mut roots = allowed_roots.write().unwrap();
                if let Ok(canonical) = std::fs::canonicalize(&cache_dir) {
                    roots.insert(canonical);
                } else {
                    roots.insert(cache_dir.clone());
                }
            }

            let port = tauri::async_runtime::block_on(server::start_server(
                db.clone(),
                image_svc.clone(),
                thumbnail_svc.clone(),
                policy.clone(),
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
            settings_commands::load_settings,
            settings_commands::save_settings,
            commands::request_thumbnail,
            commands::cancel_thumbnail,
            archive_commands::scan_archive,
            archive_commands::get_archive_info,
            archive_commands::get_cache_stats,
            archive_commands::clear_thumbnails,
            archive_commands::clear_extracted,
            archive_commands::pin_cache,
            archive_commands::unlock_archive,
            archive_commands::requires_master_password,
            archive_commands::get_archive_secret_ref,
            archive_commands::mark_archive_secret_stored,
            archive_commands::check_migration,
            archive_commands::confirm_migration,
            archive_commands::startup_cache_cleanup,
            archive_commands::set_cache_policy,
            archive_commands::set_source_policy,
            library_commands::list_library_sources,
            library_commands::add_library_sources,
            library_commands::update_library_source,
            library_commands::remove_library_sources,
            library_commands::mark_library_sources_scanned,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
