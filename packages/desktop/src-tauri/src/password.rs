use std::collections::HashMap;
use std::sync::Mutex;

/// In-memory archive password cache for the current process only.
pub struct PasswordCache {
    passwords: Mutex<HashMap<String, String>>,
}

impl PasswordCache {
    pub fn new() -> Self {
        Self {
            passwords: Mutex::new(HashMap::new()),
        }
    }

    pub fn get(&self, archive_path: &str) -> Option<String> {
        self.passwords.lock().ok()?.get(archive_path).cloned()
    }

    pub fn set(&self, archive_path: &str, password: &str) {
        if let Ok(mut passwords) = self.passwords.lock() {
            passwords.insert(archive_path.to_string(), password.to_string());
        }
    }

    pub fn remove(&self, archive_path: &str) {
        if let Ok(mut passwords) = self.passwords.lock() {
            passwords.remove(archive_path);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::PasswordCache;

    #[test]
    fn caches_passwords_for_only_the_current_process() {
        let cache = PasswordCache::new();
        cache.set("D:/pack.zip", "secret");
        assert_eq!(cache.get("D:/pack.zip").as_deref(), Some("secret"));
        cache.remove("D:/pack.zip");
        assert!(cache.get("D:/pack.zip").is_none());
    }
}
