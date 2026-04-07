export interface WImage {
  source: string;
  relativePath: string;
  width: number | null;
  height: number | null;
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

export type Locale = "en" | "zh";

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
