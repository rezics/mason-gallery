import {
  type DropBatch,
  DropCoordinator,
  type DroppedSource,
  dedupeDroppedSources,
  libraryEffectForDropBehavior,
  Toaster,
  toast,
  useCoreRuntime,
  useI18n,
  useSettingsStore,
} from "@mason-gallery/core";
import type { SupportedLanguage } from "@mason-gallery/i18n";
import { useEffect } from "react";
import { pickWebFolderSources } from "../adapters/WebPlatformService";
import { WebEmptyGallery } from "../features/gallery/WebGalleryPage";
import { stashPendingWebAppOpen } from "../features/gallery/webAppLaunch";
import { getWebAppHref } from "../features/i18n/webLocaleRoutes";
import { WebTopBar } from "./WebTopBar";

export function EmbeddedWebApp({ locale }: { locale: SupportedLanguage }) {
  const { hydrated } = useCoreRuntime({
    enableStartupCacheCleanup: false,
    enableThumbnailEvents: false,
  });
  const language = useSettingsStore((state) => state.language);
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const externalDropBehavior = useSettingsStore(
    (state) => state.externalDropBehavior,
  );
  const t = useI18n();

  useEffect(() => {
    if (hydrated && language !== locale) setLanguage(locale);
  }, [hydrated, language, locale, setLanguage]);

  const launchAppWithSources = (sources: DroppedSource[]) => {
    if (sources.length === 0) return;
    stashPendingWebAppOpen({
      sources,
      libraryEffect: libraryEffectForDropBehavior(externalDropBehavior),
    });
    window.location.assign(getWebAppHref(locale));
  };

  const handleOpenFolder = async () => {
    const sources = await pickWebFolderSources();
    if (!sources || sources.length === 0) return;
    stashPendingWebAppOpen({
      sources,
      libraryEffect: "ensure",
    });
    window.location.assign(getWebAppHref(locale));
  };

  const handlePageDrop = (batch: DropBatch) => {
    const unique = dedupeDroppedSources(batch.accepted);
    const skipped = batch.rejected.length;
    if (unique.length === 0) {
      if (skipped > 0) {
        toast.add({
          title: t("home:dropSummarySkippedOnly", { skipped }),
          type: "warning",
        });
      }
      return;
    }
    launchAppWithSources(unique);
  };

  if (!hydrated || language !== locale) return null;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <DropCoordinator
        galleryPath="/"
        forceAccept
        persistence="durable"
        onPageDrop={handlePageDrop}
      >
        <WebTopBar embedded />
        <div className="min-h-0 flex-1 overflow-hidden">
          <WebEmptyGallery onOpenFolder={handleOpenFolder} />
        </div>
        <Toaster />
      </DropCoordinator>
    </div>
  );
}
