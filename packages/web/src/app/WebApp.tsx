import {
  BackButton,
  Button,
  incrementalRefresh,
  QuickGalleryPanel,
  resetToDropZone,
  useAppStore,
  useCoreRuntime,
  useI18n,
  useSettingsStore,
  useViewerStore,
} from "@mason-gallery/core";
import {
  AlertTriangle,
  Github,
  Home,
  Info,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCcw,
  Settings,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Route, Router, Switch, useLocation } from "wouter";
import { WebGalleryPage } from "../features/gallery/WebGalleryPage";
import {
  getLocalizedWebPath,
  getWebLocaleFromPathname,
} from "../features/i18n/webLocaleRoutes";
import { WebSettingsPage } from "../features/settings/WebSettingsPage";

const GITHUB_URL = "https://github.com/Edge-coordinates/mason-gallery";
const NOT_FOUND_REDIRECT_SECONDS = 5;

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
  const [location, navigate] = useLocation();
  const locale = getWebLocaleFromPathname(location);
  const isSidebarOpen = useAppStore((s) => s.isSidebarOpen);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const hasGallery = useViewerStore((s) => s.images.length > 0);
  const isScanning = useViewerStore((s) => s.isScanning);

  const goHome = () => {
    resetToDropZone();
    navigate(getLocalizedWebPath("/", locale));
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
                <span className="hidden sm:inline">{t("actions:gallery")}</span>
              </WebHeaderButton>
              <WebHeaderButton
                title={t("actions:refresh")}
                disabled={isScanning}
                onClick={() => incrementalRefresh()}
              >
                <RefreshCcw className="size-5" />
                <span className="hidden sm:inline">{t("actions:refresh")}</span>
              </WebHeaderButton>
              <WebHeaderButton title="Folders" onClick={toggleSidebar}>
                {isSidebarOpen ? (
                  <PanelLeftClose className="size-5" />
                ) : (
                  <PanelLeftOpen className="size-5" />
                )}
                <span className="hidden sm:inline">{t("sidebar:folders")}</span>
              </WebHeaderButton>
            </>
          )}

          <WebHeaderButton
            title={t("settings:preferences")}
            onClick={() => navigate("/settings/gallery")}
          >
            <Settings className="size-5" />
            <span className="hidden sm:inline">
              {t("settings:preferences")}
            </span>
          </WebHeaderButton>
          <WebHeaderButton
            title={t("menu:about")}
            onClick={() => navigate(getLocalizedWebPath("/about", locale))}
          >
            <Info className="size-5" />
            <span className="hidden sm:inline">{t("menu:about")}</span>
          </WebHeaderButton>
        </nav>
      </div>
    </header>
  );
}

function WebAboutPage() {
  const t = useI18n();
  const [location] = useLocation();
  const locale = getWebLocaleFromPathname(location);

  return (
    <div className="h-full overflow-auto bg-background p-6 text-foreground">
      <div className="mx-auto max-w-2xl space-y-6">
        <BackButton
          to={getLocalizedWebPath("/", locale)}
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

function LocaleGalleryRoute() {
  const [location] = useLocation();
  return getWebLocaleFromPathname(location) ? (
    <WebGalleryPage />
  ) : (
    <WebNotFoundPage />
  );
}

function LocaleAboutRoute() {
  const [location] = useLocation();
  return getWebLocaleFromPathname(location) ? (
    <WebAboutPage />
  ) : (
    <WebNotFoundPage />
  );
}

function WebNotFoundPage() {
  const t = useI18n();
  const [, navigate] = useLocation();
  const [remaining, setRemaining] = useState(NOT_FOUND_REDIRECT_SECONDS);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRemaining((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (remaining === 0) {
      navigate("/");
    }
  }, [navigate, remaining]);

  return (
    <div className="flex h-full items-center justify-center bg-background px-6 text-foreground">
      <section className="mx-auto flex max-w-md flex-col items-center text-center">
        <div className="mb-6 flex size-14 items-center justify-center rounded-full border border-border bg-secondary text-muted-foreground">
          <AlertTriangle className="size-7" />
        </div>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          404
        </p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight">
          {t("common:notFoundTitle")}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {t("common:notFoundDescription")}
        </p>
        <p className="mt-6 text-sm text-muted-foreground">
          {t("common:notFoundRedirect", { count: remaining })}
        </p>
        <Button type="button" className="mt-6" onClick={() => navigate("/")}>
          <Home />
          {t("common:goHome")}
        </Button>
      </section>
    </div>
  );
}

function WebRuntimeLanguageSync() {
  const [location] = useLocation();
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const locale = getWebLocaleFromPathname(location);

  useEffect(() => {
    if (locale && locale !== language) {
      setLanguage(locale);
    }
  }, [language, locale, setLanguage]);

  return null;
}

export function WebApp() {
  const { hydrated } = useCoreRuntime({
    enableStartupCacheCleanup: false,
    enableThumbnailEvents: false,
  });

  if (!hydrated) return null;

  return (
    <Router>
      <WebRuntimeLanguageSync />
      <div className="flex h-screen flex-col bg-background text-foreground">
        <WebTopBar />
        <main className="min-h-0 flex-1 overflow-hidden">
          <Switch>
            <Route path="/settings" component={WebSettingsPage} />
            <Route path="/settings/:category" component={WebSettingsPage} />
            <Route path="/about" component={WebAboutPage} />
            <Route path="/:locale/about" component={LocaleAboutRoute} />
            <Route path="/:locale/about/" component={LocaleAboutRoute} />
            <Route path="/" component={WebGalleryPage} />
            <Route path="/:locale" component={LocaleGalleryRoute} />
            <Route path="/:locale/" component={LocaleGalleryRoute} />
            <Route>
              <WebNotFoundPage />
            </Route>
          </Switch>
        </main>
        <QuickGalleryPanel />
      </div>
    </Router>
  );
}
