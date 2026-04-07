import type { ColumnBreakpoints, Locale, SortMethod } from "./index";

export interface Settings {
  formats: string[];
  sortMethod: SortMethod;
  pageSize: number;
  language: Locale;
  breakpoints: ColumnBreakpoints;
  showGridPosition: boolean;
}

export interface ScanParams {
  paths: string[];
  formats: string[];
  page_size: number;
  sort_method: SortMethod;
}

export interface ImageBatch {
  images: Array<{
    source: string;
    relativePath: string;
    width: number | null;
    height: number | null;
  }>;
  done: boolean;
}

export interface PlatformCapabilities {
  canDeleteFiles: boolean;
  canSelectFolder: boolean;
  hasCustomTitlebar: boolean;
  canAutoUpdate: boolean;
  canDragDropFolders: boolean;
}

export interface PlatformService {
  capabilities: PlatformCapabilities;

  scanImages(
    params: ScanParams,
    onBatch: (batch: ImageBatch) => void,
    onComplete: () => void,
    onCount?: (total: number) => void,
  ): Promise<void>;

  getImageUrl(source: string): string;

  deleteFile(path: string): Promise<void>;

  pickFolders(): Promise<string[] | null>;

  onDragDrop(callback: (paths: string[]) => void): () => void;

  loadSettings(): Promise<Partial<Settings>>;

  saveSettings(key: string, value: unknown): Promise<void>;

  listDirectoryTree(paths: string[]): Promise<string[]>;
}
