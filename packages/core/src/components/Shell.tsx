import type { ReactNode } from "react";
import { useEffect } from "react";
import { Route, Router, Switch } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import QuickGalleryPanel from "@/components/QuickGalleryPanel";
import { usePlatform } from "@/context/PlatformContext";
import { getTranslations, I18nContext } from "@/i18n";
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
  const hydrate = useSettingsStore((s) => s.hydrate);
  const hydrated = useSettingsStore((s) => s._hydrated);
  const platform = usePlatform();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

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
    const applyTheme = () => {
      const shouldUseDark =
        theme === "dark" || (theme === "system" && media.matches);
      document.documentElement.classList.toggle("dark", shouldUseDark);
      document.documentElement.dataset.theme = theme;
    };

    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [theme]);

  if (!hydrated) return null;

  const translations = getTranslations(language);

  return (
    <I18nContext.Provider value={translations}>
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
    </I18nContext.Provider>
  );
}
