import type { SupportedLanguage } from "@mason-gallery/i18n";

export interface Thumbnail {
  source: string;
  width: number;
  height: number;
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
