import { resolveSupportedLanguage } from "@mason-gallery/i18n";
import { create } from "zustand";
import { getPlatform } from "@/context/PlatformContext";
import { normalizeCustomAccent } from "@/lib/theme";
import {
  createDefaultSettings,
  settingsSchema,
} from "@/persistence/settingsSchema";
import type { ColumnBreakpoints, Locale, SortMethod } from "@/types";
import type {
  AccentPreset,
  CacheCleanupStrategy,
  CachePolicy,
  FolderThumbnailsMode,
  GallerySourceShortcut,
  PasswordStorageMode,
  Settings,
  ThemePreference,
  ThemePreset,
  ThemeTokenOverrides,
} from "@/types/platform";

interface SettingsState extends Settings {
  /** UI convenience derived from the authoritative cachePolicy field. */
  thumbnailSizes: number[];
  _hydrated: boolean;

  setFormats: (formats: string[]) => void;
  setSortMethod: (method: SortMethod) => void;
  setPageSize: (size: number) => void;
  setLanguage: (lang: Locale) => void;
  setTheme: (theme: ThemePreference) => void;
  setThemePreset: (preset: ThemePreset) => void;
  setAccentPreset: (preset: AccentPreset) => void;
  setCustomAccent: (accent: string) => void;
  setCustomTheme: (theme: {
    light?: ThemeTokenOverrides;
    dark?: ThemeTokenOverrides;
  }) => void;
  setBreakpoints: (bp: ColumnBreakpoints) => void;
  setShowGridPosition: (show: boolean) => void;
  setOpenGallerySidebarByDefault: (open: boolean) => void;
  setConfirmDelete: (value: boolean) => void;
  setShowDeleteToast: (value: boolean) => void;
  setCacheCleanupStrategy: (strategy: CacheCleanupStrategy) => void;
  setPasswordStorageMode: (mode: PasswordStorageMode) => void;
  setCachePolicy: (policy: CachePolicy) => void;
  setThumbnailSizes: (sizes: number[]) => void;
  setFolderThumbnails: (mode: FolderThumbnailsMode) => void;
  addRecentSource: (source: GallerySourceShortcut) => void;
  toggleFavoriteSource: (source: GallerySourceShortcut) => void;
  hydrate: () => Promise<void>;
}

const DEFAULT_SETTINGS = createDefaultSettings();
const DEFAULTS = {
  ...DEFAULT_SETTINGS,
  thumbnailSizes: DEFAULT_SETTINGS.cachePolicy.thumbnailSizes,
};

const MAX_RECENT_SOURCES = 8;
const MAX_FAVORITE_SOURCES = 24;

let persistenceQueue = Promise.resolve();
let hydrationPromise: Promise<void> | null = null;

function sameGallerySource(
  a: GallerySourceShortcut,
  b: GallerySourceShortcut,
): boolean {
  return a.kind === b.kind && a.path === b.path;
}

function toPersistedSettings(state: SettingsState): Settings {
  return settingsSchema.parse({
    formats: state.formats,
    sortMethod: state.sortMethod,
    pageSize: state.pageSize,
    language: state.language,
    theme: state.theme,
    themePreset: state.themePreset,
    accentPreset: state.accentPreset,
    customAccent: state.customAccent,
    customTheme: state.customTheme,
    breakpoints: state.breakpoints,
    showGridPosition: state.showGridPosition,
    openGallerySidebarByDefault: state.openGallerySidebarByDefault,
    confirmDelete: state.confirmDelete,
    showDeleteToast: state.showDeleteToast,
    cacheCleanupStrategy: state.cacheCleanupStrategy,
    passwordStorageMode: state.passwordStorageMode,
    cachePolicy: state.cachePolicy,
    folderThumbnails: state.folderThumbnails,
    recentSources: state.recentSources,
    favoriteSources: state.favoriteSources,
  });
}

function persist(state: SettingsState): void {
  let settings: Settings;
  try {
    settings = toPersistedSettings(state);
  } catch (error) {
    console.error("Refusing to persist invalid settings:", error);
    return;
  }
  persistenceQueue = persistenceQueue
    .catch(() => undefined)
    .then(() => getPlatform().saveSettings(settings))
    .catch((error) => {
      console.error("Failed to persist settings document:", error);
    });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Settings hydration timed out")),
      timeoutMs,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULTS,
  _hydrated: false,

  setFormats: (formats) => {
    set({ formats });
    persist(get());
  },
  setSortMethod: (sortMethod) => {
    set({ sortMethod });
    persist(get());
  },
  setPageSize: (pageSize) => {
    set({ pageSize });
    persist(get());
  },
  setLanguage: (language) => {
    const resolvedLanguage = resolveSupportedLanguage(
      language,
      DEFAULTS.language,
    );
    set({ language: resolvedLanguage });
    persist(get());
  },
  setTheme: (theme) => {
    set({ theme });
    persist(get());
  },
  setThemePreset: (themePreset) => {
    set({ themePreset });
    persist(get());
  },
  setAccentPreset: (accentPreset) => {
    set({ accentPreset });
    persist(get());
  },
  setCustomAccent: (customAccent) => {
    set({ customAccent: normalizeCustomAccent(customAccent) });
    persist(get());
  },
  setCustomTheme: (customTheme) => {
    set({ customTheme });
    persist(get());
  },
  setBreakpoints: (breakpoints) => {
    set({ breakpoints });
    persist(get());
  },
  setShowGridPosition: (showGridPosition) => {
    set({ showGridPosition });
    persist(get());
  },
  setOpenGallerySidebarByDefault: (openGallerySidebarByDefault) => {
    set({ openGallerySidebarByDefault });
    persist(get());
  },
  setConfirmDelete: (confirmDelete) => {
    set({ confirmDelete });
    persist(get());
  },
  setShowDeleteToast: (showDeleteToast) => {
    set({ showDeleteToast });
    persist(get());
  },
  setCacheCleanupStrategy: (cacheCleanupStrategy) => {
    set({ cacheCleanupStrategy });
    persist(get());
  },
  setPasswordStorageMode: (passwordStorageMode) => {
    set({ passwordStorageMode });
    persist(get());
  },
  setCachePolicy: (cachePolicy) => {
    set({
      cachePolicy,
      thumbnailSizes: cachePolicy.thumbnailSizes,
    });
    persist(get());
    getPlatform()
      .setCachePolicy?.(cachePolicy)
      .catch((error) =>
        console.error("Failed to sync cachePolicy to backend:", error),
      );
  },
  setThumbnailSizes: (thumbnailSizes) => {
    const cachePolicy = {
      ...get().cachePolicy,
      thumbnailSizes,
    };
    set({ thumbnailSizes, cachePolicy });
    persist(get());
    getPlatform()
      .setCachePolicy?.(cachePolicy)
      .catch((error) =>
        console.error("Failed to sync cachePolicy to backend:", error),
      );
  },
  setFolderThumbnails: (folderThumbnails) => {
    set({ folderThumbnails });
    persist(get());
  },
  addRecentSource: (source) => {
    const nextSource = {
      ...source,
      lastOpenedAt: source.lastOpenedAt || new Date().toISOString(),
    };
    const recentSources = [
      nextSource,
      ...get().recentSources.filter((item) => !sameGallerySource(item, source)),
    ].slice(0, MAX_RECENT_SOURCES);
    set({ recentSources });
    persist(get());
  },
  toggleFavoriteSource: (source) => {
    const favoriteSources = get().favoriteSources.some((item) =>
      sameGallerySource(item, source),
    )
      ? get().favoriteSources.filter((item) => !sameGallerySource(item, source))
      : [
          {
            ...source,
            lastOpenedAt: source.lastOpenedAt || new Date().toISOString(),
          },
          ...get().favoriteSources,
        ].slice(0, MAX_FAVORITE_SOURCES);
    set({ favoriteSources });
    persist(get());
  },

  hydrate: async () => {
    if (get()._hydrated) return;
    if (hydrationPromise) return hydrationPromise;

    hydrationPromise = (async () => {
      try {
        const platform = getPlatform();
        const settings = settingsSchema.parse(
          await withTimeout(platform.loadSettings(), 3000),
        );

        set({
          ...settings,
          thumbnailSizes: settings.cachePolicy.thumbnailSizes,
          _hydrated: true,
        });

        platform
          .setCachePolicy?.(settings.cachePolicy)
          .catch((error) =>
            console.error("Failed to sync cachePolicy to backend:", error),
          );
      } catch (error) {
        console.error("Failed to hydrate settings:", error);
        set({
          ...createDefaultSettings(),
          thumbnailSizes: DEFAULTS.thumbnailSizes,
          _hydrated: true,
        });
      }
    })();

    try {
      await hydrationPromise;
    } finally {
      hydrationPromise = null;
    }
  },
}));
