import { create } from "zustand";
import { getPlatform } from "@/context/PlatformContext";
import type { ColumnBreakpoints, Locale, SortMethod } from "@/types";
import type {
  CacheCleanupStrategy,
  CachePolicy,
  PasswordStorageMode,
} from "@/types/platform";
import {
  DEFAULT_CACHE_POLICY,
  DEFAULT_THUMBNAIL_SIZES,
} from "@/types/platform";

interface SettingsState {
  formats: string[];
  sortMethod: SortMethod;
  pageSize: number;
  language: Locale;
  breakpoints: ColumnBreakpoints;
  showGridPosition: boolean;
  confirmDelete: boolean;
  showDeleteToast: boolean;
  cacheCleanupStrategy: CacheCleanupStrategy;
  passwordStorageMode: PasswordStorageMode;
  cachePolicy: CachePolicy;
  thumbnailSizes: number[];
  _hydrated: boolean;

  setFormats: (formats: string[]) => void;
  setSortMethod: (method: SortMethod) => void;
  setPageSize: (size: number) => void;
  setLanguage: (lang: Locale) => void;
  setBreakpoints: (bp: ColumnBreakpoints) => void;
  setShowGridPosition: (show: boolean) => void;
  setConfirmDelete: (v: boolean) => void;
  setShowDeleteToast: (v: boolean) => void;
  setCacheCleanupStrategy: (strategy: CacheCleanupStrategy) => void;
  setPasswordStorageMode: (mode: PasswordStorageMode) => void;
  setCachePolicy: (policy: CachePolicy) => void;
  setThumbnailSizes: (sizes: number[]) => void;
  hydrate: () => Promise<void>;
}

const DEFAULTS = {
  formats: [".webp", ".jxl", ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".jfif"],
  sortMethod: "name-asc" as SortMethod,
  pageSize: 50,
  language: "en" as Locale,
  breakpoints: {
    0: 1,
    500: 2,
    800: 3,
    1200: 4,
    1600: 5,
    1920: 6,
    2560: 7,
  } as ColumnBreakpoints,
  showGridPosition: true,
  confirmDelete: true,
  showDeleteToast: true,
  cacheCleanupStrategy: "auto-clean" as CacheCleanupStrategy,
  passwordStorageMode: "none" as PasswordStorageMode,
  cachePolicy: DEFAULT_CACHE_POLICY,
  thumbnailSizes: DEFAULT_THUMBNAIL_SIZES,
};

async function persist(key: string, value: unknown) {
  try {
    const platform = getPlatform();
    await platform.saveSettings(key, value);
  } catch (e) {
    console.error("Failed to persist setting:", key, e);
  }
}

export const useSettingsStore = create<SettingsState>((set) => ({
  ...DEFAULTS,
  _hydrated: false,

  setFormats: (formats) => {
    set({ formats });
    persist("formats", formats);
  },
  setSortMethod: (sortMethod) => {
    set({ sortMethod });
    persist("sortMethod", sortMethod);
  },
  setPageSize: (pageSize) => {
    set({ pageSize });
    persist("pageSize", pageSize);
  },
  setLanguage: (language) => {
    set({ language });
    persist("language", language);
  },
  setBreakpoints: (breakpoints) => {
    set({ breakpoints });
    persist("breakpoints", breakpoints);
  },
  setShowGridPosition: (showGridPosition) => {
    set({ showGridPosition });
    persist("showGridPosition", showGridPosition);
  },
  setConfirmDelete: (confirmDelete) => {
    set({ confirmDelete });
    persist("confirmDelete", confirmDelete);
  },
  setShowDeleteToast: (showDeleteToast) => {
    set({ showDeleteToast });
    persist("showDeleteToast", showDeleteToast);
  },
  setCacheCleanupStrategy: (cacheCleanupStrategy) => {
    set({ cacheCleanupStrategy });
    persist("cacheCleanupStrategy", cacheCleanupStrategy);
  },
  setPasswordStorageMode: (passwordStorageMode) => {
    set({ passwordStorageMode });
    persist("passwordStorageMode", passwordStorageMode);
  },
  setCachePolicy: (cachePolicy) => {
    set({ cachePolicy });
    persist("cachePolicy", cachePolicy);
    const platform = getPlatform();
    platform
      .setCachePolicy?.(cachePolicy)
      .catch((e) => console.error("Failed to sync cachePolicy to backend:", e));
  },
  setThumbnailSizes: (thumbnailSizes) => {
    set({ thumbnailSizes });
    persist("thumbnailSizes", thumbnailSizes);
  },

  hydrate: async () => {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Settings hydration timed out")), 3000),
    );

    try {
      const platform = getPlatform();
      const settings = await Promise.race([platform.loadSettings(), timeout]);

      set({
        formats: settings.formats ?? DEFAULTS.formats,
        sortMethod: settings.sortMethod ?? DEFAULTS.sortMethod,
        pageSize: settings.pageSize ?? DEFAULTS.pageSize,
        language: settings.language ?? DEFAULTS.language,
        breakpoints: settings.breakpoints ?? DEFAULTS.breakpoints,
        showGridPosition:
          settings.showGridPosition ?? DEFAULTS.showGridPosition,
        confirmDelete: settings.confirmDelete ?? DEFAULTS.confirmDelete,
        showDeleteToast: settings.showDeleteToast ?? DEFAULTS.showDeleteToast,
        cacheCleanupStrategy:
          ((settings as Record<string, unknown>)
            .cacheCleanupStrategy as CacheCleanupStrategy) ??
          DEFAULTS.cacheCleanupStrategy,
        passwordStorageMode:
          ((settings as Record<string, unknown>)
            .passwordStorageMode as PasswordStorageMode) ??
          DEFAULTS.passwordStorageMode,
        cachePolicy: settings.cachePolicy ?? DEFAULTS.cachePolicy,
        thumbnailSizes: settings.thumbnailSizes ?? DEFAULTS.thumbnailSizes,
        _hydrated: true,
      });
    } catch (e) {
      console.error("Failed to hydrate settings:", e);
      set({ _hydrated: true });
    }
  },
}));
