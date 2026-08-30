import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ConfirmDialog } from "@/components/ui/dialog";
import { usePlatform } from "@/context/PlatformContext";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { AppearanceSettingsSection } from "./settings/AppearanceSettingsSection";
import { ArchiveSettingsSection } from "./settings/ArchiveSettingsSection";
import { CacheSettingsSection } from "./settings/CacheSettingsSection";
import { FilesSettingsSection } from "./settings/FilesSettingsSection";
import { GallerySettingsSection } from "./settings/GallerySettingsSection";
import {
  getSupportedSettingsCategories,
  getVisibleSettingsCategory,
  type SettingsCategory,
} from "./settings/settingsRoutes";

export default function SettingsPage() {
  const t = useI18n();
  const platform = usePlatform();
  const [location, navigate] = useLocation();
  const visibleCategory = getVisibleSettingsCategory(
    location,
    platform.capabilities,
  );
  const [clearConfirm, setClearConfirm] = useState<
    null | "thumbs" | "extracted"
  >(null);

  const categoryLabels: Record<SettingsCategory, string> = {
    appearance: t("settings:appearance"),
    gallery: t("settings:gallery"),
    files: t("settings:files"),
    archive: t("archive:settingsSection"),
    cache: t("cache:section"),
  };

  const supportedCategories = getSupportedSettingsCategories(
    platform.capabilities,
  );

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden bg-background sm:flex-row">
      <nav className="shrink-0 border-b p-3 sm:w-56 sm:border-r sm:border-b-0 sm:p-4">
        <h1 className="mb-3 px-2 text-lg font-semibold sm:mb-4">
          {t("settings:preferences")}
        </h1>
        <div className="flex gap-1 overflow-x-auto sm:grid">
          {supportedCategories.map((item) => (
            <Link
              key={item}
              href={`/settings/${item}`}
              className={cn(
                "shrink-0 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                item === visibleCategory && "bg-accent text-accent-foreground",
              )}
            >
              {categoryLabels[item]}
            </Link>
          ))}
        </div>
      </nav>

      <div className="min-w-0 flex-1 overflow-auto p-4 sm:p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <header>
            <h2 className="text-2xl font-semibold">
              {categoryLabels[visibleCategory]}
            </h2>
          </header>

          {visibleCategory === "appearance" && <AppearanceSettingsSection />}
          {visibleCategory === "gallery" && <GallerySettingsSection />}
          {visibleCategory === "files" && <FilesSettingsSection />}
          {visibleCategory === "archive" && (
            <ArchiveSettingsSection
              onManageCache={() => navigate("/manage/cache")}
            />
          )}
          {visibleCategory === "cache" && (
            <CacheSettingsSection onClearRequested={setClearConfirm} />
          )}
        </div>
      </div>

      <ConfirmDialog
        open={clearConfirm !== null}
        title={
          clearConfirm === "thumbs"
            ? t("cache:clearThumbs")
            : t("cache:clearExtracted")
        }
        cancelLabel={t("archive:cancel")}
        confirmLabel={t("cache:confirm")}
        destructive
        onCancel={() => setClearConfirm(null)}
        onConfirm={async () => {
          const target = clearConfirm;
          setClearConfirm(null);
          if (target === "thumbs") await platform.clearThumbnails?.();
          if (target === "extracted") await platform.clearExtracted?.();
        }}
      >
        <p>
          {clearConfirm === "thumbs"
            ? t("cache:clearThumbsConfirm")
            : t("cache:clearExtractedConfirm")}
        </p>
      </ConfirmDialog>
    </div>
  );
}
