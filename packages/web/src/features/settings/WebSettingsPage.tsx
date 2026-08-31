import { BackButton, useI18n } from "@mason-gallery/core";
import { cn } from "@mason-gallery/core/lib/utils";
import { AppearanceSettingsSection } from "@mason-gallery/core/pages/settings/AppearanceSettingsSection";
import { GallerySettingsSection } from "@mason-gallery/core/pages/settings/GallerySettingsSection";
import { GeneralSettingsSection } from "@mason-gallery/core/pages/settings/GeneralSettingsSection";
import { Link, useLocation } from "wouter";
import {
  getWebSettingsCategory,
  WEB_SETTINGS_CATEGORIES,
  type WebSettingsCategory,
} from "./webSettingsRoutes";

export function WebSettingsPage() {
  const t = useI18n();
  const [location] = useLocation();
  const visibleCategory = getWebSettingsCategory(location);

  const categoryLabels: Record<WebSettingsCategory, string> = {
    general: t("settings:general"),
    gallery: t("settings:gallery"),
    appearance: t("settings:appearance"),
  };

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden bg-background sm:flex-row">
      <nav className="shrink-0 border-b p-3 sm:w-56 sm:border-r sm:border-b-0 sm:p-4">
        <div className="mb-3 flex items-center gap-2 sm:block">
          <BackButton
            variant="ghost"
            size="sm"
            className="justify-start px-2 sm:mb-3"
          />
          <h1 className="text-lg font-semibold sm:mb-4">
            {t("settings:preferences")}
          </h1>
        </div>
        <div className="flex gap-1 overflow-x-auto sm:grid">
          {WEB_SETTINGS_CATEGORIES.map((item) => (
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

          {visibleCategory === "general" && <GeneralSettingsSection />}
          {visibleCategory === "gallery" && <GallerySettingsSection />}
          {visibleCategory === "appearance" && <AppearanceSettingsSection />}
        </div>
      </div>
    </div>
  );
}
