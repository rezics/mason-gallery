import {
  incrementalRefresh,
  resetToDropZone,
  useAppStore,
  useI18n,
  useSettingsStore,
  useViewerStore,
} from "@mason-gallery/core";
import {
  languageLabels,
  type SupportedLanguage,
  supportedLanguages,
} from "@mason-gallery/i18n";
import type { MouseEvent, MouseEventHandler } from "react";
import { useLocation } from "wouter";
import {
  getLocalizedWebPath,
  getWebAppSettingsHref,
} from "../features/i18n/webLocaleRoutes";
import { WebHeader } from "./WebHeader";

export function WebTopBar({ embedded = false }: { embedded?: boolean }) {
  const t = useI18n();
  const [location, navigate] = useLocation();
  const language = useSettingsStore((state) => state.language);
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const isSidebarOpen = useAppStore((state) => state.isSidebarOpen);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const hasGallery = useViewerStore((state) => state.images.length > 0);
  const isScanning = useViewerStore((state) => state.isScanning);
  const rootPath = getLocalizedWebPath("/", language);
  const appHomePath = "/app/";
  const preferencesHref = getWebAppSettingsHref(language);

  const goHome = () => {
    resetToDropZone();
    if (embedded) {
      document.getElementById("app-entry")?.scrollIntoView();
      return;
    }
    const current = location.split("?")[0] ?? location;
    if (current !== "/") {
      navigate("/");
    }
  };

  const handleBrandClick: MouseEventHandler<HTMLAnchorElement> = (event) => {
    event.preventDefault();
    goHome();
  };

  const handlePreferencesClick:
    | MouseEventHandler<HTMLAnchorElement>
    | undefined = embedded
    ? undefined
    : (event) => {
        event.preventDefault();
        navigate("/settings/general");
      };

  const handleLanguageSelect = (
    nextLanguage: SupportedLanguage,
    event: MouseEvent<HTMLAnchorElement>,
  ) => {
    setLanguage(nextLanguage);
    if (!embedded) {
      event.preventDefault();
      const url = new URL(window.location.href);
      url.searchParams.set("lang", nextLanguage);
      window.history.replaceState(window.history.state, "", url);
    }
  };

  return (
    <WebHeader
      preferencesLabel={t("settings:preferences")}
      aboutLabel={t("menu:about")}
      brandHref={embedded ? rootPath : appHomePath}
      preferencesHref={preferencesHref}
      aboutHref={getLocalizedWebPath("/about", language)}
      languageMenu={{
        label: t("settings:language"),
        currentLanguage: language,
        options: supportedLanguages.map((optionLanguage) => ({
          language: optionLanguage,
          label: languageLabels[optionLanguage],
          href: embedded
            ? getLocalizedWebPath("/", optionLanguage)
            : `?lang=${optionLanguage}`,
        })),
        onSelect: handleLanguageSelect,
      }}
      activeItem={
        !embedded && location.startsWith("/settings")
          ? "preferences"
          : undefined
      }
      onBrandClick={handleBrandClick}
      onPreferencesClick={handlePreferencesClick}
      galleryActions={
        hasGallery
          ? {
              homeLabel: t("actions:gallery"),
              refreshLabel: t("actions:refresh"),
              foldersLabel: t("sidebar:folders"),
              isSidebarOpen,
              isScanning,
              onHome: goHome,
              onRefresh: incrementalRefresh,
              onToggleSidebar: toggleSidebar,
            }
          : undefined
      }
    />
  );
}
