use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::io::Read;
use std::path::Path;

/// Errors specific to archive operations
#[derive(Debug)]
pub enum ArchiveError {
    PasswordRequired,
    WrongPassword,
    UnsupportedFormat(String),
    Io(String),
    Other(String),
}

impl std::fmt::Display for ArchiveError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ArchiveError::PasswordRequired => write!(f, "PasswordRequired"),
            ArchiveError::WrongPassword => write!(f, "WrongPassword"),
            ArchiveError::UnsupportedFormat(fmt) => write!(f, "UnsupportedFormat: {}", fmt),
            ArchiveError::Io(msg) => write!(f, "IO: {}", msg),
            ArchiveError::Other(msg) => write!(f, "{}", msg),
        }
    }
}

/// An entry within an archive
#[derive(Debug, Clone)]
pub struct ArchiveEntry {
    pub path: String,
    pub compressed_size: u64,
    pub uncompressed_size: u64,
    pub is_directory: bool,
}

/// Metadata about an archive
#[derive(Debug, Clone)]
pub struct ArchiveInfo {
    pub format: String,
    pub entry_count: usize,
    pub total_size: u64,
    pub is_solid: bool,
    pub is_encrypted: bool,
}

/// Trait for reading different archive formats
pub trait ArchiveReader: Send + Sync {
    fn list_entries(&self, password: Option<&str>) -> Result<Vec<ArchiveEntry>, ArchiveError>;
    fn extract_entry(
        &self,
        entry_path: &str,
        output_path: &Path,
        password: Option<&str>,
    ) -> Result<(), ArchiveError>;
    fn extract_entry_to_memory(
        &self,
        entry_path: &str,
        password: Option<&str>,
    ) -> Result<Vec<u8>, ArchiveError>;
    fn get_info(&self, password: Option<&str>) -> Result<ArchiveInfo, ArchiveError>;
    fn is_encrypted(&self) -> Result<bool, ArchiveError>;
    fn is_solid(&self) -> Result<bool, ArchiveError>;
}

/// Detect archive format from magic bytes and return the appropriate reader
pub fn open_archive(path: &Path) -> Result<Box<dyn ArchiveReader>, ArchiveError> {
    let mut file = fs::File::open(path)
        .map_err(|e| ArchiveError::Io(format!("Failed to open file: {}", e)))?;

    let mut magic = [0u8; 8];
    std::io::Read::read(&mut file, &mut magic)
        .map_err(|e| ArchiveError::Io(format!("Failed to read magic bytes: {}", e)))?;

    let path_str = path.to_string_lossy().to_string();

    // ZIP: PK\x03\x04
    if magic[0] == 0x50 && magic[1] == 0x4B && magic[2] == 0x03 && magic[3] == 0x04 {
        return Ok(Box::new(ZipArchiveReader::new(path_str)?));
    }

    // RAR: Rar!\x1A\x07
    if magic[0] == 0x52
        && magic[1] == 0x61
        && magic[2] == 0x72
        && magic[3] == 0x21
        && magic[4] == 0x1A
        && magic[5] == 0x07
    {
        return Ok(Box::new(RarArchiveReader::new(path_str)?));
    }

    // 7z: 7z\xBC\xAF\x27\x1C
    if magic[0] == 0x37
        && magic[1] == 0x7A
        && magic[2] == 0xBC
        && magic[3] == 0xAF
        && magic[4] == 0x27
        && magic[5] == 0x1C
    {
        return Ok(Box::new(SevenZArchiveReader::new(path_str)?));
    }

    // Fallback: try by extension
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();

    match ext.as_str() {
        "zip" | "cbz" => Ok(Box::new(ZipArchiveReader::new(path_str)?)),
        "rar" | "cbr" => Ok(Box::new(RarArchiveReader::new(path_str)?)),
        "7z" => Ok(Box::new(SevenZArchiveReader::new(path_str)?)),
        _ => Err(ArchiveError::UnsupportedFormat(ext)),
    }
}

/// Parse `archive:///path/to/archive.zip#internal/path/image.jpg`
pub fn parse_archive_uri(uri: &str) -> Result<(String, String), ArchiveError> {
    let rest = uri
        .strip_prefix("archive:///")
        .ok_or_else(|| ArchiveError::Other("Invalid archive URI scheme".to_string()))?;

    let (archive_path, entry_path) = rest
        .split_once('#')
        .ok_or_else(|| ArchiveError::Other("Missing # separator in archive URI".to_string()))?;

    Ok((archive_path.to_string(), entry_path.to_string()))
}

/// Compute a hash for cache key purposes
pub fn compute_archive_hash(path: &str, file_size: u64, mtime: u64) -> String {
    let mut hasher = DefaultHasher::new();
    path.hash(&mut hasher);
    file_size.hash(&mut hasher);
    mtime.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

/// Compute a hash for an entry path (used for thumbnail filenames)
pub fn compute_entry_hash(entry_path: &str) -> String {
    let mut hasher = DefaultHasher::new();
    entry_path.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

/// Check if a file extension is a supported archive
pub fn is_archive_extension(ext: &str) -> bool {
    matches!(
        ext.to_lowercase().as_str(),
        "zip" | "rar" | "7z" | "cbz" | "cbr"
    )
}

fn map_zip_error(e: zip::result::ZipError) -> ArchiveError {
    match e {
        zip::result::ZipError::UnsupportedArchive(msg)
            if msg == zip::result::ZipError::PASSWORD_REQUIRED =>
        {
            ArchiveError::PasswordRequired
        }
        zip::result::ZipError::InvalidPassword => ArchiveError::WrongPassword,
        other => ArchiveError::Other(format!("ZIP error: {}", other)),
    }
}

// ---- ZIP Implementation ----

pub struct ZipArchiveReader {
    path: String,
}

impl ZipArchiveReader {
    pub fn new(path: String) -> Result<Self, ArchiveError> {
        Ok(Self { path })
    }

    fn open_archive(
        &self,
    ) -> Result<zip::ZipArchive<std::io::BufReader<fs::File>>, ArchiveError> {
        let file = fs::File::open(&self.path)
            .map_err(|e| ArchiveError::Io(format!("Failed to open ZIP: {}", e)))?;
        let reader = std::io::BufReader::new(file);
        zip::ZipArchive::new(reader)
            .map_err(|e| ArchiveError::Other(format!("Failed to read ZIP: {}", e)))
    }
}

impl ArchiveReader for ZipArchiveReader {
    fn list_entries(&self, _password: Option<&str>) -> Result<Vec<ArchiveEntry>, ArchiveError> {
        let mut archive = self.open_archive()?;
        let mut entries = Vec::new();

        for i in 0..archive.len() {
            let file = archive
                .by_index_raw(i)
                .map_err(|e| ArchiveError::Other(format!("Failed to read entry: {}", e)))?;

            let name = file.name().to_string();
            entries.push(ArchiveEntry {
                path: name,
                compressed_size: file.compressed_size(),
                uncompressed_size: file.size(),
                is_directory: file.is_dir(),
            });
        }

        Ok(entries)
    }

    fn extract_entry(
        &self,
        entry_path: &str,
        output_path: &Path,
        password: Option<&str>,
    ) -> Result<(), ArchiveError> {
        let data = self.extract_entry_to_memory(entry_path, password)?;
        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| ArchiveError::Io(format!("Failed to create output dir: {}", e)))?;
        }
        fs::write(output_path, &data)
            .map_err(|e| ArchiveError::Io(format!("Failed to write file: {}", e)))?;
        Ok(())
    }

    fn extract_entry_to_memory(
        &self,
        entry_path: &str,
        password: Option<&str>,
    ) -> Result<Vec<u8>, ArchiveError> {
        let mut archive = self.open_archive()?;

        let mut file = if let Some(pw) = password {
            archive
                .by_name_decrypt(entry_path, pw.as_bytes())
                .map_err(map_zip_error)?
        } else {
            archive.by_name(entry_path).map_err(map_zip_error)?
        };

        let mut buf = Vec::with_capacity(file.size() as usize);
        file.read_to_end(&mut buf)
            .map_err(|e| ArchiveError::Io(format!("Failed to read entry data: {}", e)))?;
        Ok(buf)
    }

    fn get_info(&self, _password: Option<&str>) -> Result<ArchiveInfo, ArchiveError> {
        let mut archive = self.open_archive()?;
        let mut total_size: u64 = 0;
        let mut entry_count: usize = 0;
        let mut is_encrypted = false;

        for i in 0..archive.len() {
            if let Ok(file) = archive.by_index_raw(i) {
                if !file.is_dir() {
                    entry_count += 1;
                    total_size += file.size();
                }
                if file.encrypted() {
                    is_encrypted = true;
                }
            }
        }

        Ok(ArchiveInfo {
            format: "zip".to_string(),
            entry_count,
            total_size,
            is_solid: false,
            is_encrypted,
        })
    }

    fn is_encrypted(&self) -> Result<bool, ArchiveError> {
        let mut archive = self.open_archive()?;
        for i in 0..archive.len() {
            if let Ok(file) = archive.by_index_raw(i) {
                if file.encrypted() {
                    return Ok(true);
                }
            }
        }
        Ok(false)
    }

    fn is_solid(&self) -> Result<bool, ArchiveError> {
        Ok(false) // ZIP never supports solid compression
    }
}

// ---- RAR Implementation ----

pub struct RarArchiveReader {
    path: String,
}

impl RarArchiveReader {
    pub fn new(path: String) -> Result<Self, ArchiveError> {
        Ok(Self { path })
    }

    fn map_rar_error(e: unrar::error::UnrarError) -> ArchiveError {
        match e.code {
            unrar::error::Code::MissingPassword => ArchiveError::PasswordRequired,
            unrar::error::Code::BadPassword => ArchiveError::WrongPassword,
            _ => ArchiveError::Other(format!("RAR error: {:?}", e)),
        }
    }
}

impl ArchiveReader for RarArchiveReader {
    fn list_entries(&self, password: Option<&str>) -> Result<Vec<ArchiveEntry>, ArchiveError> {
        let opened = if let Some(pw) = password {
            unrar::Archive::with_password(&self.path, pw)
                .open_for_listing()
                .map_err(Self::map_rar_error)?
        } else {
            unrar::Archive::new(&self.path)
                .open_for_listing()
                .map_err(Self::map_rar_error)?
        };

        let mut entries = Vec::new();
        for entry_result in opened {
            match entry_result {
                Ok(entry) => {
                    entries.push(ArchiveEntry {
                        path: entry
                            .filename
                            .to_string_lossy()
                            .to_string()
                            .replace('\\', "/"),
                        compressed_size: entry.unpacked_size as u64,
                        uncompressed_size: entry.unpacked_size as u64,
                        is_directory: entry.is_directory(),
                    });
                }
                Err(e) => return Err(Self::map_rar_error(e)),
            }
        }

        Ok(entries)
    }

    fn extract_entry(
        &self,
        entry_path: &str,
        output_path: &Path,
        password: Option<&str>,
    ) -> Result<(), ArchiveError> {
        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| ArchiveError::Io(format!("Failed to create output dir: {}", e)))?;
        }

        let output_dir = output_path.parent().unwrap_or_else(|| Path::new("."));

        let opened = if let Some(pw) = password {
            unrar::Archive::with_password(&self.path, pw)
                .open_for_processing()
                .map_err(Self::map_rar_error)?
        } else {
            unrar::Archive::new(&self.path)
                .open_for_processing()
                .map_err(Self::map_rar_error)?
        };

        // Normalize entry_path for comparison
        let normalized_entry = entry_path.replace('\\', "/");

        // Process mode: iterate with read_header
        let mut cursor = opened;
        loop {
            match cursor.read_header() {
                Ok(Some(header)) => {
                    let entry_name = header
                        .entry()
                        .filename
                        .to_string_lossy()
                        .to_string()
                        .replace('\\', "/");
                    if entry_name == normalized_entry {
                        header
                            .extract_to(output_dir)
                            .map_err(|e| {
                                ArchiveError::Other(format!("RAR extract error: {:?}", e))
                            })?;
                        return Ok(());
                    } else {
                        cursor = header
                            .skip()
                            .map_err(|e| {
                                ArchiveError::Other(format!("RAR skip error: {:?}", e))
                            })?;
                    }
                }
                Ok(None) => break,
                Err(e) => return Err(Self::map_rar_error(e)),
            }
        }

        Err(ArchiveError::Other(format!(
            "Entry not found in RAR: {}",
            entry_path
        )))
    }

    fn extract_entry_to_memory(
        &self,
        entry_path: &str,
        password: Option<&str>,
    ) -> Result<Vec<u8>, ArchiveError> {
        let opened = if let Some(pw) = password {
            unrar::Archive::with_password(&self.path, pw)
                .open_for_processing()
                .map_err(Self::map_rar_error)?
        } else {
            unrar::Archive::new(&self.path)
                .open_for_processing()
                .map_err(Self::map_rar_error)?
        };

        let normalized_entry = entry_path.replace('\\', "/");

        let mut cursor = opened;
        loop {
            match cursor.read_header() {
                Ok(Some(header)) => {
                    let entry_name = header
                        .entry()
                        .filename
                        .to_string_lossy()
                        .to_string()
                        .replace('\\', "/");
                    if entry_name == normalized_entry {
                        let (data, _) = header.read().map_err(|e| {
                            ArchiveError::Other(format!("RAR read error: {:?}", e))
                        })?;
                        return Ok(data);
                    } else {
                        cursor = header.skip().map_err(|e| {
                            ArchiveError::Other(format!("RAR skip error: {:?}", e))
                        })?;
                    }
                }
                Ok(None) => break,
                Err(e) => return Err(Self::map_rar_error(e)),
            }
        }

        Err(ArchiveError::Other(format!(
            "Entry not found in RAR: {}",
            entry_path
        )))
    }

    fn get_info(&self, password: Option<&str>) -> Result<ArchiveInfo, ArchiveError> {
        let entries = self.list_entries(password)?;
        let is_solid = self.is_solid()?;
        let is_encrypted = self.is_encrypted()?;

        let file_entries: Vec<_> = entries.iter().filter(|e| !e.is_directory).collect();
        let total_size: u64 = file_entries.iter().map(|e| e.uncompressed_size).sum();

        Ok(ArchiveInfo {
            format: "rar".to_string(),
            entry_count: file_entries.len(),
            total_size,
            is_solid,
            is_encrypted,
        })
    }

    fn is_encrypted(&self) -> Result<bool, ArchiveError> {
        let archive = unrar::Archive::new(&self.path);
        match archive.open_for_listing() {
            Ok(iter) => {
                for entry in iter {
                    if let Err(e) = entry {
                        if matches!(
                            e.code,
                            unrar::error::Code::MissingPassword
                                | unrar::error::Code::BadPassword
                        ) {
                            return Ok(true);
                        }
                    }
                }
                Ok(false)
            }
            Err(e) => {
                if matches!(
                    e.code,
                    unrar::error::Code::MissingPassword | unrar::error::Code::BadPassword
                ) {
                    Ok(true)
                } else {
                    Err(ArchiveError::Other(format!(
                        "Failed to check RAR encryption: {:?}",
                        e
                    )))
                }
            }
        }
    }

    fn is_solid(&self) -> Result<bool, ArchiveError> {
        // The unrar crate v0.5 doesn't directly expose the solid flag.
        Ok(false)
    }
}

// ---- 7z Implementation ----

pub struct SevenZArchiveReader {
    path: String,
}

impl SevenZArchiveReader {
    pub fn new(path: String) -> Result<Self, ArchiveError> {
        Ok(Self { path })
    }

    fn open_reader(
        &self,
        password: Option<&str>,
    ) -> Result<sevenz_rust::SevenZReader<fs::File>, ArchiveError> {
        let pw = match password {
            Some(pw) => sevenz_rust::Password::from(pw),
            None => sevenz_rust::Password::empty(),
        };

        sevenz_rust::SevenZReader::open(&self.path, pw).map_err(|e| {
            let msg = format!("{:?}", e);
            if msg.contains("assword") {
                ArchiveError::PasswordRequired
            } else {
                ArchiveError::Other(format!("Failed to open 7z: {}", msg))
            }
        })
    }
}

impl ArchiveReader for SevenZArchiveReader {
    fn list_entries(&self, password: Option<&str>) -> Result<Vec<ArchiveEntry>, ArchiveError> {
        let reader = self.open_reader(password)?;

        let mut entries = Vec::new();
        for entry in reader.archive().files.iter() {
            let name = entry.name().to_string();
            entries.push(ArchiveEntry {
                path: name,
                compressed_size: entry.compressed_size,
                uncompressed_size: entry.size(),
                is_directory: entry.is_directory(),
            });
        }

        Ok(entries)
    }

    fn extract_entry(
        &self,
        entry_path: &str,
        output_path: &Path,
        password: Option<&str>,
    ) -> Result<(), ArchiveError> {
        let data = self.extract_entry_to_memory(entry_path, password)?;
        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| ArchiveError::Io(format!("Failed to create output dir: {}", e)))?;
        }
        fs::write(output_path, &data)
            .map_err(|e| ArchiveError::Io(format!("Failed to write file: {}", e)))?;
        Ok(())
    }

    fn extract_entry_to_memory(
        &self,
        entry_path: &str,
        password: Option<&str>,
    ) -> Result<Vec<u8>, ArchiveError> {
        let mut reader = self.open_reader(password)?;

        let mut found_data: Option<Vec<u8>> = None;
        reader
            .for_each_entries(
                |entry: &sevenz_rust::SevenZArchiveEntry, reader: &mut dyn Read| {
                    if entry.name() == entry_path {
                        let mut buf = Vec::with_capacity(entry.size() as usize);
                        reader.read_to_end(&mut buf).ok();
                        found_data = Some(buf);
                    }
                    Ok(true)
                },
            )
            .map_err(|e| ArchiveError::Other(format!("7z iteration error: {:?}", e)))?;

        found_data
            .ok_or_else(|| ArchiveError::Other(format!("Entry not found in 7z: {}", entry_path)))
    }

    fn get_info(&self, password: Option<&str>) -> Result<ArchiveInfo, ArchiveError> {
        let entries = self.list_entries(password)?;
        let is_solid = self.is_solid()?;
        let is_encrypted = self.is_encrypted()?;

        let file_entries: Vec<_> = entries.iter().filter(|e| !e.is_directory).collect();
        let total_size: u64 = file_entries.iter().map(|e| e.uncompressed_size).sum();

        Ok(ArchiveInfo {
            format: "7z".to_string(),
            entry_count: file_entries.len(),
            total_size,
            is_solid,
            is_encrypted,
        })
    }

    fn is_encrypted(&self) -> Result<bool, ArchiveError> {
        match sevenz_rust::SevenZReader::open(&self.path, sevenz_rust::Password::empty()) {
            Ok(_) => Ok(false),
            Err(e) => {
                let msg = format!("{:?}", e);
                Ok(msg.contains("assword"))
            }
        }
    }

    fn is_solid(&self) -> Result<bool, ArchiveError> {
        match sevenz_rust::SevenZReader::open(&self.path, sevenz_rust::Password::empty()) {
            Ok(reader) => {
                let file_count = reader
                    .archive()
                    .files
                    .iter()
                    .filter(|f| !f.is_directory())
                    .count();
                let folder_count = reader.archive().folders.len();
                Ok(folder_count > 0 && file_count > 0 && folder_count < file_count / 2)
            }
            Err(_) => Ok(false),
        }
    }
}
