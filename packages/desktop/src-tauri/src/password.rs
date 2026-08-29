use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use pbkdf2::pbkdf2_hmac;
use rand::RngCore;
use sha2::Sha256;
use std::collections::HashMap;
use std::sync::Mutex;

const PBKDF2_ITERATIONS: u32 = 100_000;
const SALT_LEN: usize = 16;
const NONCE_LEN: usize = 12;
const KEY_LEN: usize = 32;

/// In-memory password cache for the current session
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
        let map = self.passwords.lock().ok()?;
        map.get(archive_path).cloned()
    }

    pub fn set(&self, archive_path: &str, password: &str) {
        if let Ok(mut map) = self.passwords.lock() {
            map.insert(archive_path.to_string(), password.to_string());
        }
    }

    pub fn remove(&self, archive_path: &str) {
        if let Ok(mut map) = self.passwords.lock() {
            map.remove(archive_path);
        }
    }
}

/// In-memory master password for the current application session.
///
/// The master password is deliberately never persisted. Once supplied and
/// verified against a stored archive password, it can decrypt other saved
/// passwords until the application exits.
pub struct MasterPasswordCache {
    password: Mutex<Option<String>>,
}

impl MasterPasswordCache {
    pub fn new() -> Self {
        Self {
            password: Mutex::new(None),
        }
    }

    pub fn get(&self) -> Option<String> {
        self.password.lock().ok()?.clone()
    }

    pub fn set(&self, password: &str) {
        if let Ok(mut cached) = self.password.lock() {
            *cached = Some(password.to_string());
        }
    }
}

/// Encrypt a password with a master password using AES-256-GCM
pub fn encrypt_password(plaintext: &str, master_password: &str) -> Result<String, String> {
    let mut salt = [0u8; SALT_LEN];
    OsRng.fill_bytes(&mut salt);

    let mut key = [0u8; KEY_LEN];
    pbkdf2_hmac::<Sha256>(
        master_password.as_bytes(),
        &salt,
        PBKDF2_ITERATIONS,
        &mut key,
    );

    let cipher =
        Aes256Gcm::new_from_slice(&key).map_err(|e| format!("Failed to create cipher: {}", e))?;

    let mut nonce_bytes = [0u8; NONCE_LEN];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| format!("Encryption failed: {}", e))?;

    // Format: base64(salt + nonce + ciphertext)
    let mut combined = Vec::with_capacity(SALT_LEN + NONCE_LEN + ciphertext.len());
    combined.extend_from_slice(&salt);
    combined.extend_from_slice(&nonce_bytes);
    combined.extend_from_slice(&ciphertext);

    use std::fmt::Write;
    let mut hex = String::with_capacity(combined.len() * 2);
    for byte in &combined {
        write!(hex, "{:02x}", byte).unwrap();
    }

    Ok(hex)
}

/// Decrypt a password with a master password
pub fn decrypt_password(encrypted_hex: &str, master_password: &str) -> Result<String, String> {
    let combined = hex_to_bytes(encrypted_hex).map_err(|e| format!("Invalid hex: {}", e))?;

    if combined.len() < SALT_LEN + NONCE_LEN + 1 {
        return Err("Encrypted data too short".to_string());
    }

    let salt = &combined[..SALT_LEN];
    let nonce_bytes = &combined[SALT_LEN..SALT_LEN + NONCE_LEN];
    let ciphertext = &combined[SALT_LEN + NONCE_LEN..];

    let mut key = [0u8; KEY_LEN];
    pbkdf2_hmac::<Sha256>(
        master_password.as_bytes(),
        salt,
        PBKDF2_ITERATIONS,
        &mut key,
    );

    let cipher =
        Aes256Gcm::new_from_slice(&key).map_err(|e| format!("Failed to create cipher: {}", e))?;

    let nonce = Nonce::from_slice(nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| "Wrong master password".to_string())?;

    String::from_utf8(plaintext).map_err(|e| format!("Invalid UTF-8: {}", e))
}

fn hex_to_bytes(hex: &str) -> Result<Vec<u8>, String> {
    if !hex.len().is_multiple_of(2) {
        return Err("Odd-length hex string".to_string());
    }
    (0..hex.len())
        .step_by(2)
        .map(|i| {
            u8::from_str_radix(&hex[i..i + 2], 16)
                .map_err(|e| format!("Invalid hex at {}: {}", i, e))
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::{decrypt_password, encrypt_password};

    #[test]
    fn encrypted_password_round_trips() {
        let encrypted = encrypt_password("archive-secret", "master-secret")
            .expect("password encryption should succeed");

        let decrypted = decrypt_password(&encrypted, "master-secret")
            .expect("password decryption should succeed");

        assert_eq!(decrypted, "archive-secret");
        assert_ne!(encrypted, "archive-secret");
    }

    #[test]
    fn wrong_master_password_is_rejected() {
        let encrypted = encrypt_password("archive-secret", "master-secret")
            .expect("password encryption should succeed");

        assert!(decrypt_password(&encrypted, "different-master").is_err());
    }

    #[test]
    fn malformed_ciphertext_is_rejected() {
        assert!(decrypt_password("not-hex", "master-secret").is_err());
    }
}
