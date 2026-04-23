use crate::archive::compute_entry_hash;
use crate::database::Database;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

pub struct GeneratedThumbnail {
    pub width: u32,
    pub height: u32,
    pub relative_path: String,
    pub file_size: u64,
}

pub struct ThumbnailService {
    db: Arc<Database>,
    cache_dir: PathBuf,
}

impl ThumbnailService {
    pub fn new(db: Arc<Database>, cache_dir: PathBuf) -> Self {
        Self { db, cache_dir }
    }

    pub fn cache_dir(&self) -> &Path {
        &self.cache_dir
    }

    pub fn thumbs_root(&self) -> PathBuf {
        self.cache_dir.join("thumbs")
    }

    pub fn thumb_path(&self, source_hash: &str, entry_hash: &str, width: u32) -> PathBuf {
        self.thumbs_root()
            .join(source_hash)
            .join(format!("{}_{}.webp", entry_hash, width))
    }

    /// Lookup only — returns the existing file path, or None if no thumbnail
    /// has been generated at the requested width.
    pub fn resolve(
        &self,
        source_hash: &str,
        entry_hash: &str,
        width: u32,
    ) -> Option<PathBuf> {
        let p = self.thumb_path(source_hash, entry_hash, width);
        if p.exists() {
            Some(p)
        } else {
            None
        }
    }

    /// Generate multi-resolution thumbnails for an archive entry.
    ///
    /// Given the decoded source bytes and the requested widths (descending
    /// order is fine — we sort internally), produces one WebP per unique
    /// width <= the original width (upscaling disabled), records each in the
    /// `thumbnails` table, and returns descriptors for the caller.
    pub fn generate_for_entry(
        &self,
        source_id: i64,
        source_hash: &str,
        entry_path: &str,
        image_data: &[u8],
        widths: &[u32],
    ) -> Result<Vec<GeneratedThumbnail>, String> {
        self.generate_for_entry_cancelable(
            source_id,
            source_hash,
            entry_path,
            image_data,
            widths,
            None,
        )
    }

    /// Same as `generate_for_entry`, but checks `cancel` between resize steps
    /// and aborts early if the flag is set. Returns `Err("canceled")` on abort.
    pub fn generate_for_entry_cancelable(
        &self,
        source_id: i64,
        source_hash: &str,
        entry_path: &str,
        image_data: &[u8],
        widths: &[u32],
        cancel: Option<&Arc<AtomicBool>>,
    ) -> Result<Vec<GeneratedThumbnail>, String> {
        let canceled = |c: Option<&Arc<AtomicBool>>| -> bool {
            c.map(|f| f.load(Ordering::Acquire)).unwrap_or(false)
        };

        if canceled(cancel) {
            return Err("canceled".to_string());
        }

        let entry_hash = compute_entry_hash(entry_path);
        let img = image::load_from_memory(image_data)
            .map_err(|e| format!("Failed to decode image: {}", e))?;
        let (orig_w, orig_h) = (img.width(), img.height());

        let mut sorted: Vec<u32> = widths.iter().copied().filter(|&w| w > 0).collect();
        sorted.sort_unstable();
        sorted.dedup();

        let mut results = Vec::new();

        for &w in &sorted {
            if canceled(cancel) {
                return Err("canceled".to_string());
            }

            // Never upscale.
            let target_w = w.min(orig_w.max(1));
            let aspect = orig_h as f32 / orig_w.max(1) as f32;
            let target_h = ((target_w as f32) * aspect).round().max(1.0) as u32;

            let thumb = if target_w == orig_w && target_h == orig_h {
                img.clone()
            } else {
                img.thumbnail(target_w, target_h)
            };
            let th = thumb.height();

            if canceled(cancel) {
                return Err("canceled".to_string());
            }

            let out = self.thumb_path(source_hash, &entry_hash, w);
            if let Some(parent) = out.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create thumb dir: {}", e))?;
            }
            thumb
                .save(&out)
                .map_err(|e| format!("Failed to save thumbnail: {}", e))?;

            let size = fs::metadata(&out).map(|m| m.len()).unwrap_or(0);
            let rel = format!("thumbs/{}/{}_{}.webp", source_hash, entry_hash, w);

            self.db.insert_thumbnail(
                source_id,
                entry_path,
                w,
                th,
                &rel,
                size as i64,
            )?;

            results.push(GeneratedThumbnail {
                width: w,
                height: th,
                relative_path: rel,
                file_size: size,
            });

            // Guard: if target already matches the original, we've hit the
            // ceiling for this image — later requested widths would produce
            // identical dimensions and are pointless.
            if target_w >= orig_w {
                break;
            }
        }

        // Refresh cache-size tally for this source.
        let total: i64 = self
            .db
            .get_all_thumbnails_for_source(source_id)?
            .iter()
            .filter_map(|t| t.file_size)
            .sum();
        self.db.set_thumb_cache_size(source_id, total)?;

        Ok(results)
    }

    /// Generate thumbnails for a loose filesystem file (folder entry).
    ///
    /// `entry_path` is the absolute filesystem path; the same value is used as
    /// the thumbnails-table entry key (stable across scans). Returns
    /// `Err("canceled")` if the cancel flag trips mid-generation.
    pub fn generate_for_file(
        &self,
        source_id: i64,
        source_hash: &str,
        entry_path: &str,
        widths: &[u32],
        cancel: Option<&Arc<AtomicBool>>,
    ) -> Result<Vec<GeneratedThumbnail>, String> {
        let bytes = fs::read(entry_path)
            .map_err(|e| format!("Failed to read {}: {}", entry_path, e))?;
        self.generate_for_entry_cancelable(
            source_id,
            source_hash,
            entry_path,
            &bytes,
            widths,
            cancel,
        )
    }

    /// Build an `mg-thumb://` URI for a given source/entry/width.
    pub fn build_uri(source_hash: &str, entry_hash: &str, width: u32) -> String {
        format!("mg-thumb:///{}/{}?w={}", source_hash, entry_hash, width)
    }

    pub fn clear_for_source(&self, source_id: i64, source_hash: &str) -> Result<(), String> {
        let dir = self.thumbs_root().join(source_hash);
        let _ = fs::remove_dir_all(&dir);
        self.db.delete_thumbnails_for_source(source_id)?;
        self.db.set_thumb_cache_size(source_id, 0)?;
        Ok(())
    }

    pub fn clear_all(&self) -> Result<(), String> {
        let _ = fs::remove_dir_all(self.thumbs_root());
        self.db.delete_all_thumbnails()
    }
}
