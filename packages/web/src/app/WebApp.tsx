import {
  incrementalRefresh,
  QuickGalleryPanel,
  resetToDropZone,
  useAppStore,
  useCoreRuntime,
  useI18n,
  useViewerStore,
} from "@mason-gallery/core";
import {
  Home,
  Info,
  RefreshCcw,
  Settings,
  SlidersHorizontal,
} from "lucide-react";
import type { ReactNode } from "react";
import { Route, Router, Switch, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { WebGalleryPage } from "../features/gallery/WebGalleryPage";
import { WebSettingsPage } from "../features/settings/WebSettingsPage";

function WebHeaderButton({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-35"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function WebTopBar() {
  const t = useI18n();
  const [, navigate] = useLocation();
  const toggleQuickPanel = useAppStore((s) => s.toggleQuickPanel);
  const hasGallery = useViewerStore((s) => s.images.length > 0);

  const goHome = () => {
    resetToDropZone();
    navigate("/");
  };

  return (
    <header className="z-10 shrink-0 border-b border-border/70 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-6">
        <button
          type="button"
          className="flex min-w-0 items-center gap-3 rounded-md pr-2 text-left"
          onClick={goHome}
        >
          <span className="grid size-9 place-items-center rounded-md border border-border bg-card shadow-sm">
            <img src="/logo/logo.svg" alt="" className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold leading-5 text-foreground">
              Mason Gallery
            </span>
            <span className="block text-xs leading-4 text-muted-foreground">
              Browser gallery
            </span>
          </span>
        </button>

        <div className="min-w-4 flex-1" />

        <nav className="flex items-center gap-1">
          {hasGallery && (
            <>
              <WebHeaderButton title="Home" onClick={goHome}>
                <Home className="size-4" />
                Home
              </WebHeaderButton>
              <WebHeaderButton
                title={t("actions:refresh")}
                onClick={() => incrementalRefresh()}
              >
                <RefreshCcw className="size-4" />
                Refresh
              </WebHeaderButton>
            </>
          )}
          <WebHeaderButton
            title={t("actions:quickControls")}
            onClick={toggleQuickPanel}
          >
            <SlidersHorizontal className="size-4" />
            Tune
          </WebHeaderButton>
          <WebHeaderButton
            title={t("settings:preferences")}
            onClick={() => navigate("/settings/appearance")}
          >
            <Settings className="size-4" />
            Settings
          </WebHeaderButton>
          <WebHeaderButton
            title={t("menu:about")}
            onClick={() => navigate("/about")}
          >
            <Info className="size-4" />
            About
          </WebHeaderButton>
        </nav>
      </div>
    </header>
  );
}

function WebAboutPage() {
  const t = useI18n();
  const [, navigate] = useLocation();

  return (
    <div className="h-full overflow-auto bg-background p-6 text-foreground">
      <div className="mx-auto max-w-2xl space-y-5">
        <button
          type="button"
          className="rounded-md px-2 py-1 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
          onClick={() => navigate("/")}
        >
          {t("settings:backToGallery")}
        </button>
        <header>
          <h1 className="text-2xl font-semibold">Mason Gallery</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {t("about:description")}
          </p>
        </header>
      </div>
    </div>
  );
}

export function WebApp() {
  const { hydrated } = useCoreRuntime({
    enableStartupCacheCleanup: false,
    enableThumbnailEvents: false,
  });

  if (!hydrated) return null;

  return (
    <Router hook={useHashLocation}>
      <div className="flex h-screen flex-col bg-background text-foreground">
        <WebTopBar />
        <main className="min-h-0 flex-1 overflow-hidden">
          <Switch>
            <Route path="/" component={WebGalleryPage} />
            <Route path="/about" component={WebAboutPage} />
            <Route path="/settings" component={WebSettingsPage} />
            <Route path="/settings/:category" component={WebSettingsPage} />
            <Route>
              <WebGalleryPage />
            </Route>
          </Switch>
        </main>
        <QuickGalleryPanel />
      </div>
    </Router>
  );
}
