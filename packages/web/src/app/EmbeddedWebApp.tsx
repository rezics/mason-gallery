import {
  DropCoordinator,
  Toaster,
  useCoreRuntime,
  useSettingsStore,
} from "@mason-gallery/core";
import type { SupportedLanguage } from "@mason-gallery/i18n";
import { useEffect, useRef, useState } from "react";
import { WebGalleryPage } from "../features/gallery/WebGalleryPage";
import { WebTopBar } from "./WebTopBar";

export function EmbeddedWebApp({ locale }: { locale: SupportedLanguage }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerReady, setContainerReady] = useState(false);
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
    <div
      ref={(node) => {
        containerRef.current = node;
        if (node && !containerReady) setContainerReady(true);
      }}
      className="flex h-full min-h-0 flex-col bg-background text-foreground"
    >
      {containerReady && (
        <DropCoordinator galleryPath="/" targetRef={containerRef}>
          <WebTopBar embedded />
          <div className="min-h-0 flex-1 overflow-hidden">
            <WebGalleryPage />
          </div>
          <Toaster />
        </DropCoordinator>
      )}
    </div>
  );
}
