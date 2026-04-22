pub mod archive_service;
pub mod image_service;
pub mod policy;
pub mod source_service;
pub mod thumbnail_service;

use dashmap::DashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Per-entry async mutex coordinating concurrent extractions.
/// Key format: `"<source-hash>:<entry-hash>"`.
pub type ExtractLocks = Arc<DashMap<String, Arc<Mutex<()>>>>;

pub fn new_extract_locks() -> ExtractLocks {
    Arc::new(DashMap::new())
}

pub async fn acquire_entry_lock(
    locks: &ExtractLocks,
    source_hash: &str,
    entry_hash: &str,
) -> tokio::sync::OwnedMutexGuard<()> {
    let key = format!("{}:{}", source_hash, entry_hash);
    let mutex = locks
        .entry(key)
        .or_insert_with(|| Arc::new(Mutex::new(())))
        .clone();
    mutex.lock_owned().await
}
