import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { Route, Router, Switch } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import QuickGalleryPanel from "@/components/QuickGalleryPanel";
import { usePlatform } from "@/context/PlatformContext";
import { setI18nLanguage } from "@/i18n";
import {
  applyThemeTokens,
  resolveThemeMode,
  resolveThemeTokens,
} from "@/lib/theme";
import AboutPage from "@/pages/AboutPage";
import CachePage from "@/pages/CachePage";
import HomePage from "@/pages/HomePage";
import SettingsPage from "@/pages/SettingsPage";
import { useSettingsStore } from "@/stores/settingsStore";
import { useViewerStore } from "@/stores/viewerStore";

interface ShellProps {
  titlebar: ReactNode;
  updateChecker: ReactNode;
}

export default function Shell({ titlebar, updateChecker }: ShellProps) {
  const language = useSettingsStore((s) => s.language);
  const theme = useSettingsStore((s) => s.theme);
  const themePreset = useSettingsStore((s) => s.themePreset);
  const accentPreset = useSettingsStore((s) => s.accentPreset);
  const customAccent = useSettingsStore((s) => s.customAccent);
  const customTheme = useSettingsStore((s) => s.customTheme);
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
  }, [platform]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyResolvedTheme = () => {
      const mode = resolveThemeMode(theme, media.matches);
      const tokens = resolveThemeTokens({
        mode,
        preset: themePreset,
        accentPreset,
        customAccent,
        customTheme,
      });
      applyThemeTokens(
        document.documentElement,
        tokens,
        mode,
        themePreset,
        accentPreset,
      );
    };

    applyResolvedTheme();
    media.addEventListener("change", applyResolvedTheme);
    return () => media.removeEventListener("change", applyResolvedTheme);
  }, [theme, themePreset, accentPreset, customAccent, customTheme]);

  useEffect(() => {
    if (!hydrated || startupCleanupStartedRef.current) return;
    startupCleanupStartedRef.current = true;
    platform
      .startupCacheCleanup?.(cacheCleanupStrategy)
      .catch((e) => console.error("Startup cache cleanup failed:", e));
  }, [hydrated, platform, cacheCleanupStrategy]);

  if (!hydrated) return null;

  return (
    <Router hook={useHashLocation}>
      {titlebar}
      <main
        className="h-screen overflow-hidden bg-background text-foreground"
        style={{ paddingTop: titlebar ? 36 : 0 }}
      >
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/about" component={AboutPage} />
          <Route path="/cache" component={CachePage} />
          <Route path="/manage/cache" component={CachePage} />
          <Route path="/settings" component={SettingsPage} />
          <Route path="/settings/:category" component={SettingsPage} />
          <Route>
            <HomePage />
          </Route>
        </Switch>
      </main>
      <QuickGalleryPanel />
      {updateChecker}
    </Router>
  );
}
