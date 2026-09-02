import {
  AppShell,
  DropCoordinator,
  ExternalOpenCoordinator,
  QuickGalleryPanel,
  Toaster,
  useCoreRuntime,
  useI18n,
} from "@mason-gallery/core";
import { LoaderCircle } from "lucide-react";
import { lazy, type ReactNode, Suspense } from "react";
import { Route, Router, Switch } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";

const AboutPage = lazy(() => import("@mason-gallery/core/pages/AboutPage"));
const CachePage = lazy(() => import("@mason-gallery/core/pages/CachePage"));
const HomePage = lazy(() => import("@mason-gallery/core/pages/HomePage"));
const LibraryPage = lazy(() => import("@mason-gallery/core/pages/LibraryPage"));
const SettingsPage = lazy(
  () => import("@mason-gallery/core/pages/SettingsPage"),
);

interface DesktopAppProps {
  titlebar: ReactNode;
  updateChecker: ReactNode;
}

function RouteFallback() {
  const t = useI18n();

  return (
    <div
      className="flex h-full items-center justify-center text-muted-foreground"
      role="status"
    >
      <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
      <span className="sr-only">{t("actions:loading")}</span>
    </div>
  );
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
        <AppShell>
          <DropCoordinator galleryPath="/gallery">
            <ExternalOpenCoordinator galleryPath="/gallery" />
            <Suspense fallback={<RouteFallback />}>
              <Switch>
                <Route path="/" component={LibraryPage} />
                <Route path="/library" component={LibraryPage} />
                <Route path="/library/favorites" component={LibraryPage} />
                <Route path="/library/recent" component={LibraryPage} />
                <Route path="/gallery" component={HomePage} />
                <Route path="/about" component={AboutPage} />
                <Route path="/cache" component={CachePage} />
                <Route path="/manage/cache" component={CachePage} />
                <Route path="/settings" component={SettingsPage} />
                <Route path="/settings/:category" component={SettingsPage} />
                <Route>
                  <LibraryPage />
                </Route>
              </Switch>
            </Suspense>
          </DropCoordinator>
        </AppShell>
      </main>
      <QuickGalleryPanel />
      <Toaster />
      {updateChecker}
    </Router>
  );
}
