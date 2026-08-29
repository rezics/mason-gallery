import { useCoreRuntime, useSettingsStore } from "@mason-gallery/core";
import type { SupportedLanguage } from "@mason-gallery/i18n";
import { useEffect } from "react";
import { WebGalleryPage } from "../features/gallery/WebGalleryPage";
import { WebTopBar } from "./WebTopBar";

export function EmbeddedWebApp({ locale }: { locale: SupportedLanguage }) {
  const { hydrated } = useCoreRuntime({
    enableStartupCacheCleanup: false,
    enableThumbnailEvents: false,
  });
  const language = useSettingsStore((state) => state.language);
  const setLanguage = useSettingsStore((state) => state.setLanguage);

  useEffect(() => {
    if (hydrated && language !== locale) setLanguage(locale);
  }, [hydrated, language, locale, setLanguage]);

  if (!hydrated || language !== locale) return null;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <WebTopBar embedded />
      <div className="min-h-0 flex-1 overflow-hidden">
        <WebGalleryPage />
      </div>
    </div>
  );
}
