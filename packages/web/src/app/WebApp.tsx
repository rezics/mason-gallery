import {
  BackButton,
  Button,
  incrementalRefresh,
  QuickGalleryPanel,
  resetToDropZone,
  useAppStore,
  useCoreRuntime,
  useI18n,
  useViewerStore,
} from "@mason-gallery/core";
import {
  Github,
  Home,
  Info,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCcw,
  Settings,
} from "lucide-react";
import type { ReactNode } from "react";
import { Route, Router, Switch, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { WebGalleryPage } from "../features/gallery/WebGalleryPage";
import { WebSettingsPage } from "../features/settings/WebSettingsPage";

const GITHUB_URL = "https://github.com/Edge-coordinates/mason-gallery";

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
      className="inline-flex h-10 items-center gap-2 rounded-md px-2 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-35 sm:px-3"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function WebTopBar() {
  const t = useI18n();
  const [, navigate] = useLocation();
  const isSidebarOpen = useAppStore((s) => s.isSidebarOpen);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const hasGallery = useViewerStore((s) => s.images.length > 0);
  const isScanning = useViewerStore((s) => s.isScanning);

  const goHome = () => {
    resetToDropZone();
    navigate("/");
  };

  return (
    <header className="z-10 shrink-0 border-b border-border bg-background/90 shadow-sm shadow-foreground/5 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:gap-4 sm:px-10 lg:px-16">
        <button
          type="button"
          className="flex min-w-0 items-center gap-3 rounded-md pr-2 text-left"
          onClick={goHome}
        >
          <img src="/logo/logo.svg" alt="" className="size-8" />
          <span className="block min-w-0 text-xl font-semibold leading-6 text-foreground">
            Mason Gallery
          </span>
        </button>

        <div className="min-w-4 flex-1" />

        <nav className="flex items-center gap-1 sm:gap-4">
          {hasGallery && (
            <>
              <WebHeaderButton title="Home" onClick={goHome}>
                <Home className="size-5" />
                <span className="hidden sm:inline">Home</span>
              </WebHeaderButton>
              <WebHeaderButton
                title={t("actions:refresh")}
                disabled={isScanning}
                onClick={() => incrementalRefresh()}
              >
                <RefreshCcw className="size-5" />
                <span className="hidden sm:inline">Refresh</span>
              </WebHeaderButton>
              <WebHeaderButton title="Folders" onClick={toggleSidebar}>
                {isSidebarOpen ? (
                  <PanelLeftClose className="size-5" />
                ) : (
                  <PanelLeftOpen className="size-5" />
                )}
                <span className="hidden sm:inline">Folders</span>
              </WebHeaderButton>
            </>
          )}

          <WebHeaderButton
            title={t("settings:preferences")}
            onClick={() => navigate("/settings/appearance")}
          >
            <Settings className="size-5" />
            <span className="hidden sm:inline">Settings</span>
          </WebHeaderButton>
          <WebHeaderButton
            title={t("menu:about")}
            onClick={() => navigate("/about")}
          >
            <Info className="size-5" />
            <span className="hidden sm:inline">About</span>
          </WebHeaderButton>
        </nav>
      </div>
    </header>
  );
}

function WebAboutPage() {
  const t = useI18n();

  return (
    <div className="h-full overflow-auto bg-background p-6 text-foreground">
      <div className="mx-auto max-w-2xl space-y-6">
        <BackButton
          variant="ghost"
          size="sm"
          className="-ml-2 justify-start px-2"
        />
        <section className="space-y-5">
          <header>
            <h1 className="text-2xl font-semibold">Mason Gallery</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t("about:description")}
            </p>
          </header>
          <Button
            type="button"
            variant="outline"
            className="justify-start"
            onClick={() => window.open(GITHUB_URL, "_blank")}
          >
            <Github />
            {t("about:github")}
          </Button>
        </section>
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
