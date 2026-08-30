import { useEffect, useRef } from "react";
import { usePlatform } from "@/context/PlatformContext";
import { setI18nLanguage } from "@/i18n";
import { applyThemeMode, resolveThemeMode } from "@/lib/theme";
import { useSettingsStore } from "@/stores/settingsStore";
import { useViewerStore } from "@/stores/viewerStore";

interface CoreRuntimeOptions {
  enableStartupCacheCleanup?: boolean;
  enableThumbnailEvents?: boolean;
}

/**
 * Wires shared runtime concerns without owning the product shell.
 * Target apps decide routes and chrome; this hook only applies shared state.
 */
export function useCoreRuntime({
  enableStartupCacheCleanup = false,
  enableThumbnailEvents = true,
}: CoreRuntimeOptions = {}) {
  const language = useSettingsStore((s) => s.language);
  const theme = useSettingsStore((s) => s.theme);
  const cacheCleanupStrategy = useSettingsStore((s) => s.cacheCleanupStrategy);
  const hydrate = useSettingsStore((s) => s.hydrate);
  const hydrated = useSettingsStore((s) => s._hydrated);
  const platform = usePlatform();
  const startupCleanupStartedRef = useRef(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    setI18nLanguage(language);
  }, [language]);

  useEffect(() => {
    if (!enableThumbnailEvents || !platform.onThumbnailsReady) return;
    const unsubscribe = platform.onThumbnailsReady(
      ({ sourceId, entryPath, thumbnails }) => {
        useViewerStore
          .getState()
          .patchThumbnails(sourceId, entryPath, thumbnails);
      },
    );
    return () => {
      unsubscribe();
    };
  }, [enableThumbnailEvents, platform]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyResolvedTheme = () => {
      const mode = resolveThemeMode(theme, media.matches);
      applyThemeMode(document.documentElement, mode);
    };

    applyResolvedTheme();
    media.addEventListener("change", applyResolvedTheme);
    return () => media.removeEventListener("change", applyResolvedTheme);
  }, [theme]);

  useEffect(() => {
    if (
      !enableStartupCacheCleanup ||
      !hydrated ||
      startupCleanupStartedRef.current
    ) {
      return;
    }
    startupCleanupStartedRef.current = true;
    platform
      .startupCacheCleanup?.(cacheCleanupStrategy)
      .catch((e) => console.error("Startup cache cleanup failed:", e));
  }, [enableStartupCacheCleanup, hydrated, platform, cacheCleanupStrategy]);

  return { hydrated };
}
