import { BackButton, useI18n } from "@mason-gallery/core";
import { cn } from "@mason-gallery/core/lib/utils";
import { AppearanceSettingsSection } from "@mason-gallery/core/pages/settings/AppearanceSettingsSection";
import { GallerySettingsSection } from "@mason-gallery/core/pages/settings/GallerySettingsSection";
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
    appearance: t("settings:appearance"),
    gallery: t("settings:gallery"),
  };

  return (
    <div className="flex h-full overflow-hidden bg-background">
      <nav className="w-56 shrink-0 border-r border-border p-4">
        <BackButton
          variant="ghost"
          size="sm"
          className="mb-3 justify-start px-2"
        />
        <h1 className="mb-4 text-lg font-semibold">
          {t("settings:preferences")}
        </h1>
        <div className="grid gap-1">
          {WEB_SETTINGS_CATEGORIES.map((item) => (
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
        </div>
      </div>
    </div>
  );
}
