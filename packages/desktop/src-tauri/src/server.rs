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
use tokio::net::TcpListener;

pub type AllowedRoots = Arc<RwLock<HashSet<PathBuf>>>;

pub struct ServerState {
    pub port: u16,
    pub allowed_roots: AllowedRoots,
}

#[derive(serde::Deserialize)]
struct ImageQuery {
    path: Option<String>,
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
    State(state): State<AllowedRoots>,
    headers: HeaderMap,
    Query(query): Query<ImageQuery>,
) -> Response {
    let raw_path = match query.path {
        Some(p) if !p.is_empty() => p,
        _ => return (StatusCode::BAD_REQUEST, "Missing 'path' query parameter").into_response(),
    };

    let requested = PathBuf::from(&raw_path);
    let canonical = match fs::canonicalize(&requested) {
        Ok(p) => p,
        Err(_) => return StatusCode::NOT_FOUND.into_response(),
    };

    if !is_path_allowed(&canonical, &state) {
        return StatusCode::FORBIDDEN.into_response();
    }

    let metadata = match fs::metadata(&canonical) {
        Ok(m) => m,
        Err(_) => return StatusCode::NOT_FOUND.into_response(),
    };

    if !metadata.is_file() {
        return StatusCode::NOT_FOUND.into_response();
    }

    let etag = compute_etag(&canonical, &metadata);

    if let Some(if_none_match) = headers.get(header::IF_NONE_MATCH) {
        if let Ok(val) = if_none_match.to_str() {
            if val == etag {
                return StatusCode::NOT_MODIFIED.into_response();
            }
        }
    }

    let body = match fs::read(&canonical) {
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

pub async fn start_server(allowed_roots: AllowedRoots) -> Result<u16, Box<dyn std::error::Error>> {
    let app = Router::new()
        .route("/image", get(image_handler))
        .with_state(allowed_roots);

    let listener = TcpListener::bind(SocketAddr::from(([127, 0, 0, 1], 0))).await?;
    let port = listener.local_addr()?.port();

    tokio::spawn(async move {
        axum::serve(listener, app).await.ok();
    });

    Ok(port)
}
