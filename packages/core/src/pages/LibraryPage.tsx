import { FolderOpen, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { AddGalleriesDialog } from "@/components/AddGalleriesDialog";
import { LibrarySourceTable } from "@/components/LibrarySourceTable";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { useI18n } from "@/i18n";
import { startArchiveScan, startScan } from "@/lib/scanActions";
import { useLibraryStore } from "@/stores/libraryStore";
import type { LibrarySource, LibrarySourceKind } from "@/types/platform";

type LibraryFilter = "all" | LibrarySourceKind;

export default function LibraryPage() {
  const t = useI18n();
  const [location, navigate] = useLocation();
  const sources = useLibraryStore((state) => state.sources);
  const isLoading = useLibraryStore((state) => state.isLoading);
  const error = useLibraryStore((state) => state.error);
  const hydrate = useLibraryStore((state) => state.hydrate);
  const updateSource = useLibraryStore((state) => state.updateSource);
  const removeSources = useLibraryStore((state) => state.removeSources);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<LibraryFilter>("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isAdding, setIsAdding] = useState(false);
  const [removeIds, setRemoveIds] = useState<number[]>([]);
  const [renameSource, setRenameSource] = useState<LibrarySource | null>(null);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const mode = location.startsWith("/library/favorites")
    ? "favorites"
    : location.startsWith("/library/recent")
      ? "recent"
      : "all";

  const visibleSources = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return sources
      .filter((source) => {
        if (mode === "favorites" && !source.isFavorite) return false;
        if (mode === "recent" && !source.lastOpenedAt) return false;
        if (kindFilter !== "all" && source.kind !== kindFilter) return false;
        return (
          !normalizedQuery ||
          source.label.toLocaleLowerCase().includes(normalizedQuery) ||
          source.path.toLocaleLowerCase().includes(normalizedQuery)
        );
      })
      .sort((left, right) => {
        if (mode === "recent") {
          return (right.lastOpenedAt ?? "").localeCompare(
            left.lastOpenedAt ?? "",
          );
        }
        if (left.isFavorite !== right.isFavorite) {
          return left.isFavorite ? -1 : 1;
        }
        return left.label.localeCompare(right.label);
      });
  }, [kindFilter, mode, query, sources]);

  useEffect(() => {
    const sourceIds = new Set(sources.map((source) => source.id));
    setSelected(
      (current) => new Set([...current].filter((id) => sourceIds.has(id))),
    );
  }, [sources]);

  const openSource = (source: LibrarySource, rescan = false) => {
    navigate("/gallery");
    if (source.kind === "archive") {
      void startArchiveScan(source.path);
    } else {
      void startScan([source.path], rescan);
    }
  };

  const title =
    mode === "favorites"
      ? t("library:favorites")
      : mode === "recent"
        ? t("library:recent")
        : t("library:title");

  const clearFilters = () => {
    setQuery("");
    setKindFilter("all");
  };

  return (
    <div className="flex h-full min-w-0 flex-col bg-background">
      <PageHeader
        title={title}
        description={t("library:subtitle")}
        actions={
          <Button
            type="button"
            variant="brand"
            onClick={() => setIsAdding(true)}
          >
            <Plus />
            {t("library:addGalleries")}
          </Button>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-auto px-5 py-5 sm:px-7">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label
            htmlFor="library-search"
            className="relative min-w-0 flex-1 sm:max-w-sm"
          >
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <span className="sr-only">{t("library:searchPlaceholder")}</span>
            <Input
              id="library-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("library:searchPlaceholder")}
              className="pl-9"
            />
          </label>
          <NativeSelect
            value={kindFilter}
            onChange={(event) =>
              setKindFilter(event.target.value as LibraryFilter)
            }
            className="w-full sm:w-44"
          >
            <NativeSelectOption value="all">
              {t("library:filterAll")}
            </NativeSelectOption>
            <NativeSelectOption value="folder">
              {t("library:filterFolders")}
            </NativeSelectOption>
            <NativeSelectOption value="archive">
              {t("library:filterArchives")}
            </NativeSelectOption>
          </NativeSelect>
          <span className="text-sm text-muted-foreground">
            {t("library:sourceCount", { count: visibleSources.length })}
          </span>
        </div>

        {selected.size > 0 && (
          <div className="mb-3 flex items-center justify-between rounded-xl border border-border bg-muted/35 px-3 py-2">
            <span className="text-sm font-medium">
              {t("library:selectedCount", { count: selected.size })}
            </span>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setRemoveIds([...selected])}
            >
              <Trash2 />
              {t("library:removeSelected")}
            </Button>
          </div>
        )}

        {error && (
          <p className="mb-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {sources.length === 0 && !isLoading ? (
          <Empty className="min-h-80 border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FolderOpen />
              </EmptyMedia>
              <EmptyTitle>{t("library:noSourcesTitle")}</EmptyTitle>
              <EmptyDescription>
                {t("library:noSourcesDescription")}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                type="button"
                variant="brand"
                onClick={() => setIsAdding(true)}
              >
                <Plus />
                {t("library:addGalleries")}
              </Button>
            </EmptyContent>
          </Empty>
        ) : visibleSources.length === 0 && !isLoading ? (
          <Empty className="min-h-80 border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Search />
              </EmptyMedia>
              <EmptyTitle>{t("library:noResultsTitle")}</EmptyTitle>
              <EmptyDescription>
                {t("library:noResultsDescription")}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button type="button" variant="outline" onClick={clearFilters}>
                {t("library:clearSearch")}
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <LibrarySourceTable
            sources={visibleSources}
            selected={selected}
            onSelectionChange={setSelected}
            onOpen={openSource}
            onToggleFavorite={(source) =>
              void updateSource(source.id, {
                isFavorite: !source.isFavorite,
              }).catch(() => undefined)
            }
            onRename={(source) => {
              setRenameSource(source);
              setRenameValue(source.label);
            }}
            onRemove={(source) => setRemoveIds([source.id])}
          />
        )}
      </div>

      <AddGalleriesDialog open={isAdding} onOpenChange={setIsAdding} />
      <ConfirmDialog
        open={removeIds.length > 0}
        title={t("library:removeTitle")}
        cancelLabel={t("library:cancel")}
        confirmLabel={t("library:removeConfirm")}
        destructive
        onCancel={() => setRemoveIds([])}
        onConfirm={() => {
          const ids = removeIds;
          setRemoveIds([]);
          setSelected((current) => {
            const next = new Set(current);
            for (const id of ids) next.delete(id);
            return next;
          });
          void removeSources(ids).catch(() => undefined);
        }}
      >
        <p>{t("library:removeDescription")}</p>
      </ConfirmDialog>
      <Dialog
        open={renameSource !== null}
        title={t("library:renameTitle")}
        onClose={() => setRenameSource(null)}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRenameSource(null)}
            >
              {t("library:cancel")}
            </Button>
            <Button
              type="button"
              variant="brand"
              disabled={!renameValue.trim()}
              onClick={() => {
                if (!renameSource) return;
                void updateSource(renameSource.id, {
                  label: renameValue.trim(),
                }).catch(() => undefined);
                setRenameSource(null);
              }}
            >
              {t("library:save")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          {t("library:renameDescription")}
        </p>
        <Input
          value={renameValue}
          autoFocus
          onChange={(event) => setRenameValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && renameValue.trim() && renameSource) {
              void updateSource(renameSource.id, {
                label: renameValue.trim(),
              }).catch(() => undefined);
              setRenameSource(null);
            }
          }}
        />
      </Dialog>
    </div>
  );
}
