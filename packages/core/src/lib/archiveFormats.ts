/**
 * Supported archive filename suffixes.
 *
 * Keep this list in sync with `is_archive_extension` in
 * `packages/desktop/src-tauri/src/archive.rs`. Desktop classification
 * still verifies the path is a file via filesystem metadata; this list
 * only names which files count as archives.
 */
export const ARCHIVE_EXTENSIONS = [
  ".zip",
  ".rar",
  ".7z",
  ".cbz",
  ".cbr",
] as const;

export type ArchiveExtension = (typeof ARCHIVE_EXTENSIONS)[number];

export const ARCHIVE_EXTENSION_NAMES: string[] = ARCHIVE_EXTENSIONS.map(
  (extension) => extension.slice(1),
);

export function isArchiveFileName(name: string): boolean {
  const lower = name.toLowerCase();
  return ARCHIVE_EXTENSIONS.some((extension) => lower.endsWith(extension));
}
