use crate::database::Database;
use crate::services::archive_service::{ArchiveService, ExtractResult};
use crate::services::image_service::ImageService;
use crate::services::policy::{parse_override, CachePolicy};
use crate::services::thumbnail_service::ThumbnailService;
use axum::{
    extract::{Query, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use std::collections::HashSet;
use std::fs;
use std::hash::{DefaultHasher, Hash, Hasher};
use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};
use tokio::net::TcpListener;

pub type AllowedRoots = Arc<RwLock<HashSet<PathBuf>>>;
pub type SharedPolicy = Arc<RwLock<CachePolicy>>;

pub struct ServerState {
    pub port: u16,
    pub allowed_roots: AllowedRoots,
}

#[derive(Clone)]
pub struct AppState {
    pub db: Arc<Database>,
    pub image_svc: Arc<ImageService>,
    pub thumbnail_svc: Arc<ThumbnailService>,
    pub policy: SharedPolicy,
}

#[derive(serde::Deserialize)]
struct ImageQuery {
    path: Option<String>,
}

#[derive(serde::Deserialize)]
struct ThumbQuery {
    source: Option<String>,
    entry: Option<String>,
    w: Option<u32>,
}

fn content_type_for_ext(ext: &str) -> &'static str {
    match ext {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "bmp" => "image/bmp",
        "svg" => "image/svg+xml",
        "avif" => "image/avif",
        "ico" => "image/x-icon",
        _ => "application/octet-stream",
    }
}

fn compute_etag(path: &Path, metadata: &fs::Metadata) -> String {
    let mut hasher = DefaultHasher::new();
    path.hash(&mut hasher);
    if let Ok(modified) = metadata.modified() {
        modified.hash(&mut hasher);
    }
    metadata.len().hash(&mut hasher);
    format!("\"{:x}\"", hasher.finish())
}

/// Compute effective policy for an archive URI by merging per-source override
/// on top of the base. For non-archive URIs, returns the base unchanged.
fn effective_policy(state: &AppState, uri: &str) -> CachePolicy {
    let base = state.policy.read().map(|p| p.clone()).unwrap_or_default();
    if let Some(rest) = uri.strip_prefix("archive:///") {
        if let Some((archive_path, _)) = rest.split_once('#') {
            if let Ok(Some(src)) = state.db.get_source_by_path(archive_path) {
                if let Some(json) = src.policy_override.as_deref() {
                    if let Some(over) = parse_override(Some(json)) {
                        return base.merged_with(Some(&over));
                    }
                }
            }
        }
    }
    base
}

async fn image_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<ImageQuery>,
) -> Response {
    let raw_path = match query.path {
        Some(p) if !p.is_empty() => p,
        _ => return (StatusCode::BAD_REQUEST, "Missing 'path' query parameter").into_response(),
    };

    let policy = effective_policy(&state, &raw_path);
    let resolved = match state.image_svc.resolve_original(&raw_path, &policy).await {
        Ok(r) => r,
        Err(msg) => {
            let code = if msg.starts_with("Forbidden") {
                StatusCode::FORBIDDEN
            } else if msg.contains("PasswordRequired") || msg.contains("WrongPassword") {
                StatusCode::UNAUTHORIZED
            } else {
                StatusCode::NOT_FOUND
            };
            return (code, msg).into_response();
        }
    };

    serve_extract(resolved, &headers)
}

async fn thumb_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<ThumbQuery>,
) -> Response {
    let source_hash = match query.source {
        Some(s) if !s.is_empty() => s,
        _ => return (StatusCode::BAD_REQUEST, "Missing 'source'").into_response(),
    };
    let entry_hash = match query.entry {
        Some(e) if !e.is_empty() => e,
        _ => return (StatusCode::BAD_REQUEST, "Missing 'entry'").into_response(),
    };
    let width = match query.w {
        Some(w) if w > 0 => w,
        _ => return (StatusCode::BAD_REQUEST, "Missing or invalid 'w'").into_response(),
    };

    let path = match state
        .thumbnail_svc
        .resolve(&source_hash, &entry_hash, width)
    {
        Some(p) => p,
        None => return StatusCode::NOT_FOUND.into_response(),
    };

    serve_file(&path, &headers)
}

fn serve_extract(result: ExtractResult, headers: &HeaderMap) -> Response {
    match result {
        ExtractResult::Cached(p) | ExtractResult::FreshPersisted(p) => serve_file(&p, headers),
        ExtractResult::Tempfile(temp_path) => {
            // Read the bytes out, then drop `temp_path` so the tempfile is cleaned up.
            let path_buf: PathBuf = temp_path.to_path_buf();
            let response = serve_file(&path_buf, headers);
            // `temp_path` drops here → deletes the file.
            drop(temp_path);
            response
        }
    }
}

fn serve_file(canonical: &Path, headers: &HeaderMap) -> Response {
    let metadata = match fs::metadata(canonical) {
        Ok(m) => m,
        Err(_) => return StatusCode::NOT_FOUND.into_response(),
    };

    if !metadata.is_file() {
        return StatusCode::NOT_FOUND.into_response();
    }

    let etag = compute_etag(canonical, &metadata);

    if let Some(if_none_match) = headers.get(header::IF_NONE_MATCH) {
        if let Ok(val) = if_none_match.to_str() {
            if val == etag {
                return StatusCode::NOT_MODIFIED.into_response();
            }
        }
    }

    let body = match fs::read(canonical) {
        Ok(b) => b,
        Err(_) => return StatusCode::NOT_FOUND.into_response(),
    };

    let ext = canonical
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();

    let mut response_headers = HeaderMap::new();
    response_headers.insert(
        header::CONTENT_TYPE,
        content_type_for_ext(&ext).parse().unwrap(),
    );
    response_headers.insert(
        header::CACHE_CONTROL,
        "private, max-age=3600, immutable".parse().unwrap(),
    );
    response_headers.insert(header::ETAG, etag.parse().unwrap());

    (StatusCode::OK, response_headers, body).into_response()
}

pub async fn start_server(
    db: Arc<Database>,
    image_svc: Arc<ImageService>,
    thumbnail_svc: Arc<ThumbnailService>,
    policy: SharedPolicy,
) -> Result<u16, Box<dyn std::error::Error>> {
    let state = AppState {
        db,
        image_svc,
        thumbnail_svc,
        policy,
    };

    let app = Router::new()
        .route("/image", get(image_handler))
        .route("/thumb", get(thumb_handler))
        .with_state(state);

    let listener = TcpListener::bind(SocketAddr::from(([127, 0, 0, 1], 0))).await?;
    let port = listener.local_addr()?.port();

    tokio::spawn(async move {
        axum::serve(listener, app).await.ok();
    });

    Ok(port)
}

// Helper retained for compatibility with legacy callers; prefer direct service
// construction. Returns a pre-wired `ArchiveService`, though the server itself
// owns a single shared `Arc<ArchiveService>` via `ImageService`.
#[allow(dead_code)]
pub fn new_archive_service() -> ArchiveService {
    ArchiveService::new()
}
