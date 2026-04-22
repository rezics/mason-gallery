use crate::archive::{compute_archive_hash, compute_entry_hash, parse_archive_uri};
use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode, header},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use std::collections::HashSet;
use std::fs;
use std::hash::{DefaultHasher, Hash, Hasher};
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use std::time::UNIX_EPOCH;
use tokio::net::TcpListener;

pub type AllowedRoots = Arc<RwLock<HashSet<PathBuf>>>;

pub struct ServerState {
    pub port: u16,
    pub allowed_roots: AllowedRoots,
}

#[derive(Clone)]
struct AppState {
    allowed_roots: AllowedRoots,
    cache_dir: PathBuf,
}

#[derive(serde::Deserialize)]
struct ImageQuery {
    path: Option<String>,
}

#[derive(serde::Deserialize)]
struct ThumbQuery {
    archive: Option<String>,
    entry: Option<String>,
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

fn compute_etag(path: &PathBuf, metadata: &fs::Metadata) -> String {
    let mut hasher = DefaultHasher::new();
    path.hash(&mut hasher);
    if let Ok(modified) = metadata.modified() {
        modified.hash(&mut hasher);
    }
    metadata.len().hash(&mut hasher);
    format!("\"{:x}\"", hasher.finish())
}

fn is_path_allowed(canonical: &PathBuf, allowed_roots: &AllowedRoots) -> bool {
    let roots = allowed_roots.read().unwrap();
    roots.iter().any(|root| canonical.starts_with(root))
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

    // Handle archive:/// URIs by resolving to cached thumbnails
    if raw_path.starts_with("archive:///") {
        return serve_archive_thumb(&state, &headers, &raw_path);
    }

    let requested = PathBuf::from(&raw_path);
    let canonical = match fs::canonicalize(&requested) {
        Ok(p) => p,
        Err(_) => return StatusCode::NOT_FOUND.into_response(),
    };

    if !is_path_allowed(&canonical, &state.allowed_roots) {
        return StatusCode::FORBIDDEN.into_response();
    }

    serve_file(&canonical, &headers)
}

fn serve_archive_thumb(state: &AppState, headers: &HeaderMap, uri: &str) -> Response {
    let (archive_path, entry_path) = match parse_archive_uri(uri) {
        Ok(pair) => pair,
        Err(_) => return StatusCode::BAD_REQUEST.into_response(),
    };

    let metadata = match fs::metadata(&archive_path) {
        Ok(m) => m,
        Err(_) => return StatusCode::NOT_FOUND.into_response(),
    };
    let file_size = metadata.len();
    let mtime = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let archive_hash = compute_archive_hash(&archive_path, file_size, mtime);
    let entry_hash = compute_entry_hash(&entry_path);

    let thumb_path = state
        .cache_dir
        .join("thumbs")
        .join(&archive_hash)
        .join(format!("{}.webp", entry_hash));

    let canonical = match fs::canonicalize(&thumb_path) {
        Ok(p) => p,
        Err(_) => return StatusCode::NOT_FOUND.into_response(),
    };

    serve_file(&canonical, headers)
}

async fn thumb_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<ThumbQuery>,
) -> Response {
    let archive_hash = match query.archive {
        Some(h) if !h.is_empty() => h,
        _ => return (StatusCode::BAD_REQUEST, "Missing 'archive' query parameter").into_response(),
    };
    let entry_hash = match query.entry {
        Some(h) if !h.is_empty() => h,
        _ => return (StatusCode::BAD_REQUEST, "Missing 'entry' query parameter").into_response(),
    };

    let thumb_path = state
        .cache_dir
        .join("thumbs")
        .join(&archive_hash)
        .join(format!("{}.webp", entry_hash));

    let canonical = match fs::canonicalize(&thumb_path) {
        Ok(p) => p,
        Err(_) => return StatusCode::NOT_FOUND.into_response(),
    };

    serve_file(&canonical, &headers)
}

fn serve_file(canonical: &PathBuf, headers: &HeaderMap) -> Response {
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
    allowed_roots: AllowedRoots,
    cache_dir: PathBuf,
) -> Result<u16, Box<dyn std::error::Error>> {
    let state = AppState {
        allowed_roots,
        cache_dir,
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
