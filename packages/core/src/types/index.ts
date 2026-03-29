export interface WImage {
  source: string;
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

export interface ColumnBreakpoints {
  500: number;
  800: number;
  1200: number;
  1400: number;
}

export interface Settings {
  formats: string[];
  sortMethod: SortMethod;
  pageSize: number;
  language: Locale;
  breakpoints: ColumnBreakpoints;
}
