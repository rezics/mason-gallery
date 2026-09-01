import {
  DropCoordinator,
  openSources,
  QuickGalleryPanel,
  Toaster,
  useCoreRuntime,
  useI18n,
} from "@mason-gallery/core";
import { Home } from "lucide-react";
import { useEffect } from "react";
import { Route, Router, Switch } from "wouter";
import { WebGalleryPage } from "../features/gallery/WebGalleryPage";
import { takePendingWebAppOpen } from "../features/gallery/webAppLaunch";
import { WebSettingsPage } from "../features/settings/WebSettingsPage";
import { WebTopBar } from "./WebTopBar";

function WebNotFoundPage() {
  const t = useI18n();

  return (
    <div className="flex h-full items-center justify-center bg-background px-6 text-foreground">
      <section className="mx-auto flex max-w-md flex-col items-center text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          404
        </p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight">
          {t("common:notFoundTitle")}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {t("common:notFoundDescription")}
        </p>
        <a
          href="/app/"
          className="mt-6 inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          <Home />
          {t("common:goHome")}
        </a>
      </section>
    </div>
  );
}

function StandaloneWebGalleryPage() {
  return <WebGalleryPage />;
}

export function WebApp() {
  const { hydrated } = useCoreRuntime({
    enableStartupCacheCleanup: false,
    enableThumbnailEvents: false,
  });

  useEffect(() => {
    if (!hydrated) return;
    const pending = takePendingWebAppOpen();
    if (!pending) return;
    void openSources(pending.sources, {
      libraryEffect: pending.libraryEffect,
    });
  }, [hydrated]);

  if (!hydrated) return null;

  return (
    <Router base="/app">
      <div className="flex h-screen flex-col bg-background text-foreground">
        <WebTopBar />
        <main className="min-h-0 flex-1 overflow-hidden">
          <DropCoordinator galleryPath="/">
            <Switch>
              <Route path="/settings" component={WebSettingsPage} />
              <Route path="/settings/:category" component={WebSettingsPage} />
              <Route path="/" component={StandaloneWebGalleryPage} />
              <Route>
                <WebNotFoundPage />
              </Route>
            </Switch>
          </DropCoordinator>
        </main>
        <QuickGalleryPanel />
        <Toaster />
      </div>
    </Router>
  );
}
