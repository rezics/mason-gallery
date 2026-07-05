import { resolveSupportedLanguage } from "@mason-gallery/i18n";
import { create } from "zustand";
import { getPlatform } from "@/context/PlatformContext";
import {
  isAccentPreset,
  isThemePreset,
  normalizeCustomAccent,
} from "@/lib/theme";
import type { ColumnBreakpoints, Locale, SortMethod } from "@/types";
import type {
  AccentPreset,
  CacheCleanupStrategy,
  CachePolicy,
  FolderThumbnailsMode,
  GallerySourceShortcut,
  PasswordStorageMode,
  ThemePreference,
  ThemePreset,
  ThemeTokenOverrides,
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
  theme: ThemePreference;
  themePreset: ThemePreset;
  accentPreset: AccentPreset;
  customAccent: string;
  customTheme: { light?: ThemeTokenOverrides; dark?: ThemeTokenOverrides };
  breakpoints: ColumnBreakpoints;
  showGridPosition: boolean;
  openGallerySidebarByDefault: boolean;
  confirmDelete: boolean;
  showDeleteToast: boolean;
  cacheCleanupStrategy: CacheCleanupStrategy;
  passwordStorageMode: PasswordStorageMode;
  cachePolicy: CachePolicy;
  thumbnailSizes: number[];
  folderThumbnails: FolderThumbnailsMode;
  recentSources: GallerySourceShortcut[];
  favoriteSources: GallerySourceShortcut[];
  _hydrated: boolean;

  setFormats: (formats: string[]) => void;
  setSortMethod: (method: SortMethod) => void;
  setPageSize: (size: number) => void;
  setLanguage: (lang: Locale) => void;
  setTheme: (theme: ThemePreference) => void;
  setThemePreset: (preset: ThemePreset) => void;
  setAccentPreset: (preset: AccentPreset) => void;
  setCustomAccent: (accent: string) => void;
  setCustomTheme: (theme: SettingsState["customTheme"]) => void;
  setBreakpoints: (bp: ColumnBreakpoints) => void;
  setShowGridPosition: (show: boolean) => void;
  setOpenGallerySidebarByDefault: (open: boolean) => void;
  setConfirmDelete: (v: boolean) => void;
  setShowDeleteToast: (v: boolean) => void;
  setCacheCleanupStrategy: (strategy: CacheCleanupStrategy) => void;
  setPasswordStorageMode: (mode: PasswordStorageMode) => void;
  setCachePolicy: (policy: CachePolicy) => void;
  setThumbnailSizes: (sizes: number[]) => void;
  setFolderThumbnails: (mode: FolderThumbnailsMode) => void;
  addRecentSource: (source: GallerySourceShortcut) => void;
  toggleFavoriteSource: (source: GallerySourceShortcut) => void;
  hydrate: () => Promise<void>;
}

const DEFAULTS = {
  formats: [".webp", ".jxl", ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".jfif"],
  sortMethod: "name-asc" as SortMethod,
  pageSize: 50,
  language: "en" as Locale,
  theme: "system" as ThemePreference,
  themePreset: "mason" as ThemePreset,
  accentPreset: "rose" as AccentPreset,
  customAccent: "#e75b73",
  customTheme: {},
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
  openGallerySidebarByDefault: false,
  confirmDelete: true,
  showDeleteToast: true,
  cacheCleanupStrategy: "auto-clean" as CacheCleanupStrategy,
  passwordStorageMode: "none" as PasswordStorageMode,
  cachePolicy: DEFAULT_CACHE_POLICY,
  thumbnailSizes: DEFAULT_THUMBNAIL_SIZES,
  folderThumbnails: "off" as FolderThumbnailsMode,
  recentSources: [] as GallerySourceShortcut[],
  favoriteSources: [] as GallerySourceShortcut[],
};

const MAX_RECENT_SOURCES = 8;
const MAX_FAVORITE_SOURCES = 24;

function isGallerySourceShortcut(
  value: unknown,
): value is GallerySourceShortcut {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    (item.kind === "folder" || item.kind === "archive") &&
    typeof item.path === "string" &&
    item.path.length > 0 &&
    typeof item.label === "string" &&
    item.label.length > 0 &&
    typeof item.lastOpenedAt === "string"
  );
}

function normalizeGallerySourceShortcuts(
  value: unknown,
): GallerySourceShortcut[] {
  return Array.isArray(value) ? value.filter(isGallerySourceShortcut) : [];
}

function sameGallerySource(
  a: GallerySourceShortcut,
  b: GallerySourceShortcut,
): boolean {
  return a.kind === b.kind && a.path === b.path;
}
async function persist(key: string, value: unknown) {
  try {
    const platform = getPlatform();
    await platform.saveSettings(key, value);
  } catch (e) {
    console.error("Failed to persist setting:", key, e);
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
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
    const resolvedLanguage = resolveSupportedLanguage(
      language,
      DEFAULTS.language,
    );
    set({ language: resolvedLanguage });
    persist("language", resolvedLanguage);
  },
  setTheme: (theme) => {
    set({ theme });
    persist("theme", theme);
  },
  setThemePreset: (themePreset) => {
    set({ themePreset });
    persist("themePreset", themePreset);
  },
  setAccentPreset: (accentPreset) => {
    set({ accentPreset });
    persist("accentPreset", accentPreset);
  },
  setCustomAccent: (customAccent) => {
    const normalized = normalizeCustomAccent(customAccent);
    set({ customAccent: normalized });
    persist("customAccent", normalized);
  },
  setCustomTheme: (customTheme) => {
    // Custom tokens stay deliberately narrow; presets remain the reliable path.
    set({ customTheme });
    persist("customTheme", customTheme);
  },
  setBreakpoints: (breakpoints) => {
    set({ breakpoints });
    persist("breakpoints", breakpoints);
  },
  setShowGridPosition: (showGridPosition) => {
    set({ showGridPosition });
    persist("showGridPosition", showGridPosition);
  },
  setOpenGallerySidebarByDefault: (openGallerySidebarByDefault) => {
    set({ openGallerySidebarByDefault });
    persist("openGallerySidebarByDefault", openGallerySidebarByDefault);
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
    // Keep cachePolicy.thumbnailSizes in sync — that is what the Rust backend
    // reads when resolving widths during a scan. The flat `thumbnailSizes`
    // field is retained for UI consumers that bind to it directly.
    const mergedPolicy = {
      ...get().cachePolicy,
      thumbnailSizes,
    };
    set({ thumbnailSizes, cachePolicy: mergedPolicy });
    persist("thumbnailSizes", thumbnailSizes);
    persist("cachePolicy", mergedPolicy);
    const platform = getPlatform();
    platform
      .setCachePolicy?.(mergedPolicy)
      .catch((e) => console.error("Failed to sync cachePolicy to backend:", e));
  },
  setFolderThumbnails: (folderThumbnails) => {
    set({ folderThumbnails });
    persist("folderThumbnails", folderThumbnails);
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
    persist("recentSources", recentSources);
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
    persist("favoriteSources", favoriteSources);
  },

  hydrate: async () => {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Settings hydration timed out")), 3000),
    );

    try {
      const platform = getPlatform();
      const settings = await Promise.race([platform.loadSettings(), timeout]);
      const rawSettings = settings as Record<string, unknown>;
      const hydratedCachePolicy = (() => {
        // Unify the two fields: `thumbnailSizes` (top-level, pre-existing)
        // and `cachePolicy.thumbnailSizes` (new, authoritative for Rust).
        // If a legacy install persisted only the flat field, fold it into
        // the policy so subsequent scans pick it up.
        const basePolicy = settings.cachePolicy ?? DEFAULTS.cachePolicy;
        const sizes =
          settings.cachePolicy?.thumbnailSizes ??
          settings.thumbnailSizes ??
          DEFAULTS.thumbnailSizes;
        return { ...basePolicy, thumbnailSizes: sizes };
      })();

      const hydratedLanguage = resolveSupportedLanguage(
        rawSettings.language,
        DEFAULTS.language,
      );

      set({
        formats: settings.formats ?? DEFAULTS.formats,
        sortMethod: settings.sortMethod ?? DEFAULTS.sortMethod,
        pageSize: settings.pageSize ?? DEFAULTS.pageSize,
        language: hydratedLanguage,
        theme:
          (rawSettings.theme as ThemePreference | undefined) ?? DEFAULTS.theme,
        themePreset: isThemePreset(rawSettings.themePreset)
          ? rawSettings.themePreset
          : DEFAULTS.themePreset,
        accentPreset: isAccentPreset(rawSettings.accentPreset)
          ? rawSettings.accentPreset
          : DEFAULTS.accentPreset,
        customAccent: normalizeCustomAccent(
          typeof rawSettings.customAccent === "string"
            ? rawSettings.customAccent
            : DEFAULTS.customAccent,
        ),
        customTheme:
          (rawSettings.customTheme as
            | SettingsState["customTheme"]
            | undefined) ?? DEFAULTS.customTheme,
        breakpoints: settings.breakpoints ?? DEFAULTS.breakpoints,
        showGridPosition:
          settings.showGridPosition ?? DEFAULTS.showGridPosition,
        openGallerySidebarByDefault:
          settings.openGallerySidebarByDefault ??
          DEFAULTS.openGallerySidebarByDefault,
        confirmDelete: settings.confirmDelete ?? DEFAULTS.confirmDelete,
        showDeleteToast: settings.showDeleteToast ?? DEFAULTS.showDeleteToast,
        cacheCleanupStrategy:
          (rawSettings.cacheCleanupStrategy as
            | CacheCleanupStrategy
            | undefined) ?? DEFAULTS.cacheCleanupStrategy,
        passwordStorageMode:
          (rawSettings.passwordStorageMode as
            | PasswordStorageMode
            | undefined) ?? DEFAULTS.passwordStorageMode,
        cachePolicy: hydratedCachePolicy,
        thumbnailSizes:
          hydratedCachePolicy.thumbnailSizes ?? DEFAULTS.thumbnailSizes,
        folderThumbnails:
          settings.folderThumbnails ?? DEFAULTS.folderThumbnails,
        recentSources: normalizeGallerySourceShortcuts(
          settings.recentSources,
        ).slice(0, MAX_RECENT_SOURCES),
        favoriteSources: normalizeGallerySourceShortcuts(
          settings.favoriteSources,
        ).slice(0, MAX_FAVORITE_SOURCES),
        _hydrated: true,
      });

      if (
        rawSettings.language !== undefined &&
        rawSettings.language !== hydratedLanguage
      ) {
        persist("language", hydratedLanguage);
      }

      platform
        .setCachePolicy?.(hydratedCachePolicy)
        .catch((e) =>
          console.error("Failed to sync cachePolicy to backend:", e),
        );
    } catch (e) {
      console.error("Failed to hydrate settings:", e);
      set({ _hydrated: true });
    }
  },
}));
