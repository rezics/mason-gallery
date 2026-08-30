import {
  QuickGalleryPanel,
  Toaster,
  useCoreRuntime,
} from "@mason-gallery/core";
import AboutPage from "@mason-gallery/core/pages/AboutPage";
import CachePage from "@mason-gallery/core/pages/CachePage";
import HomePage from "@mason-gallery/core/pages/HomePage";
import SettingsPage from "@mason-gallery/core/pages/SettingsPage";
import type { ReactNode } from "react";
import { Route, Router, Switch } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";

interface DesktopAppProps {
  titlebar: ReactNode;
  updateChecker: ReactNode;
}

export function DesktopApp({ titlebar, updateChecker }: DesktopAppProps) {
  const { hydrated } = useCoreRuntime({
    enableStartupCacheCleanup: true,
    enableThumbnailEvents: true,
  });

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
      <Toaster />
      {updateChecker}
    </Router>
  );
}
