import { Archive, FolderPlus, Plus, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { usePlatform } from "@/context/PlatformContext";
import { useI18n } from "@/i18n";
import { sourceLabelFromLocator } from "@/lib/sourceLabel";
import { useDropStore } from "@/stores/dropStore";
import { useLibraryStore } from "@/stores/libraryStore";
import type { DropBatch, LibrarySourceInput } from "@/types/platform";

function sourceKey(source: Pick<LibrarySourceInput, "kind" | "path">): string {
  const normalizedPath = source.path
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/+$/g, "")
    .toLocaleLowerCase();
  return `${source.kind}:${normalizedPath}`;
}

function sourceFromLocator(
  kind: LibrarySourceInput["kind"],
  path: string,
  label?: string,
): LibrarySourceInput {
  return {
    kind,
    path,
    label: label || sourceLabelFromLocator(path),
  };
}

export function AddGalleriesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useI18n();
  const platform = usePlatform();
  const existing = useLibraryStore((state) => state.sources);
  const addSources = useLibraryStore((state) => state.addSources);
  const [{ items: staged, duplicateCount }, setStaging] = useState<{
    items: LibrarySourceInput[];
    duplicateCount: number;
  }>({ items: [], duplicateCount: 0 });
  const [isPicking, setIsPicking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const existingKeys = useMemo(
    () => new Set(existing.map(sourceKey)),
    [existing],
  );

  const stageSources = useCallback(
    (sources: LibrarySourceInput[]) => {
      setStaging((current) => {
        const keys = new Set([
          ...existingKeys,
          ...current.items.map(sourceKey),
        ]);
        const next = [...current.items];
        let skipped = 0;
        for (const source of sources) {
          const key = sourceKey(source);
          if (keys.has(key)) {
            skipped += 1;
          } else {
            keys.add(key);
            next.push(source);
          }
        }
        return {
          items: next,
          duplicateCount: current.duplicateCount + skipped,
        };
      });
    },
    [existingKeys],
  );

  useEffect(() => {
    if (!open) return;
    return useDropStore.getState().registerExclusive((batch: DropBatch) => {
      stageSources(
        batch.accepted.map((source) =>
          sourceFromLocator(source.kind, source.locator, source.label),
        ),
      );
      if (batch.rejected.length > 0) {
        toast.add({
          title: t("home:dropSummarySkippedOnly", {
            skipped: batch.rejected.length,
          }),
          type: "warning",
        });
      }
    });
  }, [open, stageSources, t]);

  const resetAndClose = () => {
    setStaging({ items: [], duplicateCount: 0 });
    setError(null);
    onOpenChange(false);
  };

  const chooseFolders = async () => {
    setIsPicking(true);
    setError(null);
    try {
      const paths = await platform.pickFolders();
      if (paths) {
        stageSources(paths.map((path) => sourceFromLocator("folder", path)));
      }
    } catch (nextError) {
      setError(String(nextError));
    } finally {
      setIsPicking(false);
    }
  };

  const chooseArchives = async () => {
    setIsPicking(true);
    setError(null);
    try {
      let paths: string[] | null = null;
      if (platform.pickArchives) {
        paths = await platform.pickArchives();
      } else {
        const path = await platform.pickArchive?.();
        paths = path ? [path] : null;
      }
      if (paths) {
        stageSources(paths.map((path) => sourceFromLocator("archive", path)));
      }
    } catch (nextError) {
      setError(String(nextError));
    } finally {
      setIsPicking(false);
    }
  };

  const submit = async () => {
    if (staged.length === 0) return;
    setIsSaving(true);
    setError(null);
    try {
      await addSources(staged);
      resetAndClose();
    } catch (nextError) {
      setError(String(nextError));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DialogRoot
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isSaving && !isPicking) resetAndClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("library:dialogTitle")}</DialogTitle>
          <DialogDescription>
            {t("library:dialogDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-20 flex-col gap-2 rounded-xl"
            disabled={isPicking || isSaving}
            onClick={() => void chooseFolders()}
          >
            <FolderPlus className="size-5 text-brand" />
            {t("library:addFolder")}
          </Button>
          {platform.capabilities.canBrowseArchives && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-20 flex-col gap-2 rounded-xl"
              disabled={isPicking || isSaving}
              onClick={() => void chooseArchives()}
            >
              <Archive className="size-5 text-brand" />
              {t("library:addArchives")}
            </Button>
          )}
        </div>

        {platform.capabilities.canDragDropFolders && (
          <div className="flex min-h-16 items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/25 px-4 text-center text-sm text-muted-foreground">
            <Upload className="size-4" />
            {t("library:dropToStage")}
          </div>
        )}

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">{t("library:staged")}</h3>
            <Badge variant="secondary">{staged.length}</Badge>
          </div>
          <div className="max-h-64 overflow-auto rounded-xl border border-border">
            {staged.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                {t("library:stagedEmpty")}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {staged.map((source) => (
                  <li
                    key={sourceKey(source)}
                    className="flex min-w-0 items-center gap-3 px-3 py-2.5"
                  >
                    {source.kind === "archive" ? (
                      <Archive className="size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <FolderPlus className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {source.label}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {source.path}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("library:remove")}
                      onClick={() =>
                        setStaging((current) => ({
                          ...current,
                          items: current.items.filter(
                            (item) => sourceKey(item) !== sourceKey(source),
                          ),
                        }))
                      }
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {duplicateCount > 0 && (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {t("library:duplicateSkipped", { count: duplicateCount })}
            </p>
          )}
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </section>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isPicking || isSaving}
            onClick={resetAndClose}
          >
            {t("library:cancel")}
          </Button>
          <Button
            type="button"
            variant="brand"
            disabled={staged.length === 0 || isPicking || isSaving}
            onClick={() => void submit()}
          >
            <Plus />
            {t("library:addCount", { count: staged.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
