import { Archive, Clock, FolderOpen, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { startArchiveScan, startScan } from "@/lib/scanActions";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settingsStore";
import type { GallerySourceShortcut } from "@/types/platform";

function sameSource(a: GallerySourceShortcut, b: GallerySourceShortcut) {
  return a.kind === b.kind && a.path === b.path;
}

function SourceRow({
  source,
  isFavorite,
  onOpen,
  onToggleFavorite,
}: {
  source: GallerySourceShortcut;
  isFavorite: boolean;
  onOpen: (source: GallerySourceShortcut) => void;
  onToggleFavorite: (source: GallerySourceShortcut) => void;
}) {
  const t = useI18n();
  const Icon = source.kind === "archive" ? Archive : FolderOpen;

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-card px-2 py-2 text-card-foreground">
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-3 rounded-sm px-2 py-1 text-left outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground"
        onClick={() => onOpen(source)}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {source.label}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {source.path}
          </span>
        </span>
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        title={isFavorite ? t("home:removeFavorite") : t("home:addFavorite")}
        className={cn(isFavorite && "text-brand")}
        onClick={() => onToggleFavorite(source)}
      >
        <Star className={cn(isFavorite && "fill-current")} />
      </Button>
    </div>
  );
}

function SourceSection({
  title,
  emptyText,
  icon,
  items,
  favorites,
  onOpen,
  onToggleFavorite,
}: {
  title: string;
  emptyText: string;
  icon: "favorites" | "recent";
  items: GallerySourceShortcut[];
  favorites: GallerySourceShortcut[];
  onOpen: (source: GallerySourceShortcut) => void;
  onToggleFavorite: (source: GallerySourceShortcut) => void;
}) {
  const HeadingIcon = icon === "favorites" ? Star : Clock;

  return (
    <section className="min-w-0 space-y-3">
      <div className="flex items-center gap-2">
        <HeadingIcon className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      {items.length > 0 ? (
        <div className="grid gap-2">
          {items.map((source) => (
            <SourceRow
              key={`${source.kind}:${source.path}`}
              source={source}
              isFavorite={favorites.some((item) => sameSource(item, source))}
              onOpen={onOpen}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
          {emptyText}
        </div>
      )}
    </section>
  );
}

export default function HomeLibrarySections() {
  const t = useI18n();
  const recentSources = useSettingsStore((s) => s.recentSources);
  const favoriteSources = useSettingsStore((s) => s.favoriteSources);
  const toggleFavoriteSource = useSettingsStore((s) => s.toggleFavoriteSource);

  const openSource = (source: GallerySourceShortcut) => {
    if (source.kind === "archive") {
      startArchiveScan(source.path);
      return;
    }
    startScan([source.path]);
  };

  return (
    <section className="px-6 py-6">
      <div className="mx-auto grid max-w-4xl gap-7">
        <SourceSection
          title={t("home:favorites")}
          emptyText={t("home:noFavorites")}
          icon="favorites"
          items={favoriteSources}
          favorites={favoriteSources}
          onOpen={openSource}
          onToggleFavorite={toggleFavoriteSource}
        />
        <SourceSection
          title={t("home:recent")}
          emptyText={t("home:noRecent")}
          icon="recent"
          items={recentSources}
          favorites={favoriteSources}
          onOpen={openSource}
          onToggleFavorite={toggleFavoriteSource}
        />
      </div>
    </section>
  );
}
