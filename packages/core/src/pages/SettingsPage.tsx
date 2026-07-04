import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
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
    appearance: t.settings.appearance,
    gallery: t.settings.gallery,
    files: t.settings.files,
    archive: t.archive.settingsSection,
    cache: t.cache.section,
  };

  const supportedCategories = getSupportedSettingsCategories(
    platform.capabilities,
  );

  return (
    <div className="flex h-full overflow-hidden bg-background">
      <nav className="w-56 shrink-0 border-r border-border p-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mb-3 justify-start px-2"
          onClick={() => navigate("/")}
        >
          <ArrowLeft />
          {t.settings.backToGallery}
        </Button>
        <h1 className="mb-4 text-lg font-semibold">{t.settings.preferences}</h1>
        <div className="grid gap-1">
          {supportedCategories.map((item) => (
            <Link
              key={item}
              href={`/settings/${item}`}
              className={cn(
                "rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                item === visibleCategory && "bg-accent text-accent-foreground",
              )}
            >
              {categoryLabels[item]}
            </Link>
          ))}
        </div>
      </nav>

      <div className="flex-1 overflow-auto p-6">
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
            ? t.cache.clearThumbs
            : t.cache.clearExtracted
        }
        cancelLabel={t.archive.cancel}
        confirmLabel={t.cache.confirm}
        destructive
        onCancel={() => setClearConfirm(null)}
        onConfirm={async () => {
          const target = clearConfirm;
          setClearConfirm(null);
          if (target === "thumbs") await platform.clearThumbnails();
          if (target === "extracted") await platform.clearExtracted();
        }}
      >
        <p>
          {clearConfirm === "thumbs"
            ? t.cache.clearThumbsConfirm
            : t.cache.clearExtractedConfirm}
        </p>
      </ConfirmDialog>
    </div>
  );
}
