import type { SupportedLanguage } from "@mason-gallery/i18n";

export interface Thumbnail {
  source: string;
  width: number;
  height: number;
}

/**
 * Stable identity for a Desktop ordinary file that can enter persistent
 * multi-select. Presence of this object is the only signal that an item is
 * selectable — callers must not infer selectability from URI prefixes.
 */
export interface SelectableFileIdentity {
  /** Normalized stable key of the gallery root. */
  packageKey: string;
  /** Normalized stable key of the current file location. */
  entryKey: string;
  /** Absolute path passed to native file commands. */
  locator: string;
  /** Path relative to the gallery root, for display and rescan matching. */
  relativePath: string;
}

export interface WImage {
  source: string;
  relativePath: string;
  width: number | null;
  height: number | null;
  thumbnails?: Thumbnail[];
  /** DB id of the owning `sources` row (folder or archive). Present when the
   * backend has registered a source record for this entry. */
  sourceId?: number;
  /** True when this entry is a locked archive placeholder. Grid renders a lock
   * tile instead of an image; click opens the password dialog. */
  locked?: boolean;
  /**
   * Set only for Desktop ordinary files. Web results, archive entries, and
   * locked placeholders omit it.
   */
  selectableFile?: SelectableFileIdentity;
}

export interface ImageBatch {
  images: WImage[];
  done: boolean;
}

export interface ScanParams {
  paths: string[];
  formats: string[];
  page_size: number;
  sort_method: SortMethod;
  /**
   * Preserve currently displayed image URLs until a refresh scan completes.
   * Platforms with revocable object URLs can use this to avoid breaking the
   * rendered grid while they rescan the same source.
   */
  preserveExistingUrls?: boolean;
}

export type SortMethod = "name-asc" | "name-desc" | "time-asc" | "time-desc";

export type Locale = SupportedLanguage;

// Maps minimum screen widths (px) to column counts.
// Each entry means: "from this width up to the next entry, use N columns."
// Example: { 0: 1, 500: 2, 800: 3, 1200: 4, 1600: 5, 1920: 6, 2560: 7 }
//   0–499 px → 1 col, 500–799 px → 2 cols, …, ≥ 2560 px → 7 cols
export type ColumnBreakpoints = Record<number, number>;

export interface Settings {
  formats: string[];
  sortMethod: SortMethod;
  pageSize: number;
  language: Locale;
  breakpoints: ColumnBreakpoints;
  showGridPosition: boolean;
}
