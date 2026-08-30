import { Database, Pin, RefreshCw, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CacheSourceTable } from "@/components/CacheSourceTable";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  NativeSelectOption,
  NativeSelect as Select,
} from "@/components/ui/native-select";
import { usePlatform } from "@/context/PlatformContext";
import { useI18n } from "@/i18n";
import { useSettingsStore } from "@/stores/settingsStore";
import type {
  CachePolicy,
  CacheStats,
  ExtractedMode,
  SourceOverride,
  ThumbRetain,
} from "@/types/platform";

const MB = 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * MB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${(bytes / (1024 * MB)).toFixed(2)} GB`;
}

function parseOverride(raw: string | null | undefined): SourceOverride | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SourceOverride;
  } catch {
    return null;
  }
}

function effectivePolicy(
  base: CachePolicy,
  override: SourceOverride | null,
): CachePolicy {
  if (!override) return base;
  const widthsOverride = override.thumbnails?.widths;
  return {
    extracted: { ...base.extracted, ...override.extracted },
    thumbnails: { ...base.thumbnails, ...override.thumbnails },
    thumbnailSizes:
      widthsOverride && widthsOverride.length > 0
        ? widthsOverride
        : base.thumbnailSizes,
  };
}

interface CustomizeDialogProps {
  open: boolean;
  stats: CacheStats | null;
  base: CachePolicy;
  onClose: () => void;
  onSave: (sourceId: number, override: SourceOverride | null) => Promise<void>;
}

function CustomizeDialog({
  open,
  stats,
  base,
  onClose,
  onSave,
}: CustomizeDialogProps) {
  const t = useI18n();
  const existing = useMemo(
    () => parseOverride(stats?.policyOverride ?? null),
    [stats?.policyOverride],
  );

  const [mode, setMode] = useState<ExtractedMode | "default">(
    existing?.extracted?.mode ?? "default",
  );
  const [minFileSizeMb, setMinFileSizeMb] = useState("");
  const [maxSizeMb, setMaxSizeMb] = useState("");
  const [retain, setRetain] = useState<ThumbRetain | "default">(
    existing?.thumbnails?.retain ?? "default",
  );
  const [maxTotalMb, setMaxTotalMb] = useState("");
  const [widthsText, setWidthsText] = useState("");

  useEffect(() => {
    if (!open || !stats) return;
    const o = parseOverride(stats.policyOverride ?? null);
    setMode(o?.extracted?.mode ?? "default");
    setMinFileSizeMb(
      o?.extracted?.minFileSize != null
        ? String(Math.round(o.extracted.minFileSize / MB))
        : "",
    );
    setMaxSizeMb(
      o?.extracted?.maxSizePerSource != null
        ? String(Math.round(o.extracted.maxSizePerSource / MB))
        : "",
    );
    setRetain(o?.thumbnails?.retain ?? "default");
    setMaxTotalMb(
      o?.thumbnails?.maxTotalSize != null
        ? String(Math.round(o.thumbnails.maxTotalSize / MB))
        : "",
    );
    setWidthsText(o?.thumbnails?.widths?.join(", ") ?? "");
  }, [open, stats]);

  if (!stats) return null;

  const widthsHasText = widthsText.trim().length > 0;
  const parsedWidths = widthsText
    .split(",")
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0 && n <= 4096)
    .sort((a, b) => a - b);
  const widthsError = widthsHasText && parsedWidths.length === 0;

  const buildOverride = (): SourceOverride | null => {
    const extracted: SourceOverride["extracted"] = {};
    if (mode !== "default") extracted.mode = mode;
    const minFs = Number.parseInt(minFileSizeMb, 10);
    if (Number.isFinite(minFs) && minFs > 0) extracted.minFileSize = minFs * MB;
    const maxFs = Number.parseInt(maxSizeMb, 10);
    if (Number.isFinite(maxFs) && maxFs > 0)
      extracted.maxSizePerSource = maxFs * MB;

    const thumbnails: SourceOverride["thumbnails"] = {};
    if (retain !== "default") thumbnails.retain = retain;
    const maxTotal = Number.parseInt(maxTotalMb, 10);
    if (Number.isFinite(maxTotal) && maxTotal > 0)
      thumbnails.maxTotalSize = maxTotal * MB;
    if (parsedWidths.length > 0) thumbnails.widths = [...new Set(parsedWidths)];

    const result: SourceOverride = {};
    if (Object.keys(extracted).length > 0) result.extracted = extracted;
    if (Object.keys(thumbnails).length > 0) result.thumbnails = thumbnails;
    return Object.keys(result).length > 0 ? result : null;
  };

  const preview = effectivePolicy(base, buildOverride());

  return (
    <Dialog
      open={open}
      title={t("cache:overridePolicy")}
      className="max-w-xl"
      onClose={onClose}
      actions={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              await onSave(stats.id, null);
              onClose();
            }}
          >
            {t("cache:resetToDefaults")}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("archive:cancel")}
          </Button>
          <Button
            type="button"
            disabled={widthsError}
            onClick={async () => {
              await onSave(stats.id, buildOverride());
              onClose();
            }}
          >
            {t("cache:confirm")}
          </Button>
        </>
      }
    >
      <p className="break-all text-xs text-muted-foreground">
        {stats.originPath}
      </p>
      <div className="grid gap-3">
        <div className="grid gap-1">
          <span className="text-sm font-medium">
            {t("cache:extractedMode")}
          </span>
          <Select
            value={mode}
            onChange={(event) =>
              setMode(event.target.value as ExtractedMode | "default")
            }
          >
            <option value="default">{t("cache:useDefault")}</option>
            <option value="no-cache">{t("cache:extractedModeNoCache")}</option>
            <option value="lru-capped">{t("cache:extractedModeLru")}</option>
            <option value="unlimited">
              {t("cache:extractedModeUnlimited")}
            </option>
          </Select>
        </div>
        <Input
          type="number"
          min={0}
          value={minFileSizeMb}
          placeholder={t("cache:extractedMinFileSize")}
          onChange={(event) => setMinFileSizeMb(event.target.value)}
        />
        <Input
          type="number"
          min={0}
          value={maxSizeMb}
          placeholder={t("cache:extractedMaxSizePerSource")}
          onChange={(event) => setMaxSizeMb(event.target.value)}
        />
        <div className="grid gap-1">
          <span className="text-sm font-medium">
            {t("cache:thumbnailRetention")}
          </span>
          <Select
            value={retain}
            onChange={(event) =>
              setRetain(event.target.value as ThumbRetain | "default")
            }
          >
            <option value="default">{t("cache:useDefault")}</option>
            <option value="until-source-removed">
              {t("cache:thumbnailRetainUntilRemoved")}
            </option>
            <option value="lru-capped">{t("cache:thumbnailRetainLru")}</option>
          </Select>
        </div>
        <Input
          type="number"
          min={0}
          value={maxTotalMb}
          placeholder={t("cache:thumbnailMaxTotalSize")}
          onChange={(event) => setMaxTotalMb(event.target.value)}
        />
        <Input
          value={widthsText}
          placeholder={t("cache:thumbnailSizesHint")}
          onChange={(event) => setWidthsText(event.target.value)}
          aria-invalid={widthsError}
        />
        {widthsError && (
          <p className="text-xs text-destructive">
            {t("cache:thumbnailWidthsError")}
          </p>
        )}
        <div className="rounded-md bg-muted p-3 font-mono text-xs">
          <p>{t("cache:effectivePolicy")}</p>
          <p>extracted.mode: {preview.extracted.mode}</p>
          <p>thumbnails.retain: {preview.thumbnails.retain}</p>
          <p>thumbnailSizes: [{preview.thumbnailSizes.join(", ")}]</p>
        </div>
      </div>
    </Dialog>
  );
}

export default function CachePage() {
  const t = useI18n();
  const platform = usePlatform();
  const [stats, setStats] = useState<CacheStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | CacheStats["kind"]>(
    "all",
  );
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [customizeFor, setCustomizeFor] = useState<CacheStats | null>(null);
  const [confirmAction, setConfirmAction] = useState<
    | null
    | { type: "sources"; ids: number[] }
    | { type: "unpinned" }
    | { type: "all" }
  >(null);
  const basePolicy = useSettingsStore((s) => s.cachePolicy);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (platform.getCacheStats) {
        setStats(await platform.getCacheStats());
      }
    } catch (nextError) {
      setError(String(nextError));
    } finally {
      setIsLoading(false);
    }
  }, [platform]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const ids = new Set(stats.map((source) => source.id));
    setSelected((current) => new Set([...current].filter((id) => ids.has(id))));
  }, [stats]);

  const totalSize = stats.reduce(
    (sum, s) => sum + s.thumbCacheSize + s.extractedCacheSize,
    0,
  );
  const pinnedCount = stats.filter((source) => source.isPinned).length;
  const visibleStats = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return stats
      .filter(
        (source) =>
          (kindFilter === "all" || source.kind === kindFilter) &&
          (!normalizedQuery ||
            source.originPath.toLocaleLowerCase().includes(normalizedQuery)),
      )
      .sort(
        (left, right) =>
          Number(right.isPinned) - Number(left.isPinned) ||
          (right.lastAccessed ?? "").localeCompare(left.lastAccessed ?? ""),
      );
  }, [kindFilter, query, stats]);

  const clearSources = useCallback(
    async (ids: number[]) => {
      const operations: Promise<void>[] = [];
      for (const id of ids) {
        if (platform.clearThumbnails) {
          operations.push(platform.clearThumbnails(id));
        }
        if (platform.clearExtracted) {
          operations.push(platform.clearExtracted(id));
        }
      }
      await Promise.all(operations);
      await refresh();
    },
    [platform, refresh],
  );

  const setPinned = useCallback(
    async (ids: number[], pinned: boolean) => {
      if (!platform.pinCache) return;
      await Promise.all(ids.map((id) => platform.pinCache?.(id, pinned)));
      await refresh();
    },
    [platform, refresh],
  );

  const handleClearUnpinned = useCallback(async () => {
    await clearSources(
      stats.filter((source) => !source.isPinned).map((source) => source.id),
    );
  }, [clearSources, stats]);

  const handleClearAll = useCallback(async () => {
    await Promise.all([
      platform.clearThumbnails?.(),
      platform.clearExtracted?.(),
    ]);
    await refresh();
  }, [platform, refresh]);

  const handleSaveOverride = useCallback(
    async (sourceId: number, override: SourceOverride | null) => {
      if (platform.setSourcePolicy) {
        await platform.setSourcePolicy(sourceId, override);
        await refresh();
      }
    },
    [platform, refresh],
  );

  return (
    <div className="flex h-full min-w-0 flex-col bg-background">
      <PageHeader
        title={t("cache:title")}
        description={t("cache:description")}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={isLoading}
              onClick={() => void refresh()}
            >
              <RefreshCw className={isLoading ? "animate-spin" : undefined} />
              {t("cache:refresh")}
            </Button>
            {stats.length > 0 && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConfirmAction({ type: "unpinned" })}
                >
                  {t("archive:clearUnpinned")}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setConfirmAction({ type: "all" })}
                >
                  {t("archive:clearAll")}
                </Button>
              </>
            )}
          </>
        }
      />

      <main className="min-h-0 flex-1 overflow-auto px-5 py-5 sm:px-7">
        <section className="mb-5 grid overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-3 sm:divide-x sm:divide-border">
          {[
            [t("cache:totalSources"), String(stats.length)],
            [t("cache:totalSize"), formatSize(totalSize)],
            [t("cache:pinnedSources"), String(pinnedCount)],
          ].map(([label, value]) => (
            <div
              key={label}
              className="border-b border-border px-4 py-4 last:border-b-0 sm:border-b-0"
            >
              <p className="text-xs font-medium text-muted-foreground">
                {label}
              </p>
              <p className="mt-1 text-xl font-semibold">{value}</p>
            </div>
          ))}
        </section>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label
            htmlFor="cache-search"
            className="relative min-w-0 flex-1 sm:max-w-sm"
          >
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <span className="sr-only">{t("cache:searchPlaceholder")}</span>
            <Input
              id="cache-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("cache:searchPlaceholder")}
              className="pl-9"
            />
          </label>
          <Select
            value={kindFilter}
            onChange={(event) =>
              setKindFilter(event.target.value as typeof kindFilter)
            }
            className="w-full sm:w-44"
          >
            <NativeSelectOption value="all">
              {t("cache:allSources")}
            </NativeSelectOption>
            <NativeSelectOption value="folder">
              {t("cache:folders")}
            </NativeSelectOption>
            <NativeSelectOption value="archive">
              {t("cache:archives")}
            </NativeSelectOption>
          </Select>
        </div>

        {selected.size > 0 && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/35 px-3 py-2">
            <span className="text-sm font-medium">
              {t("cache:selected", { count: selected.size })}
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void setPinned([...selected], true)}
              >
                <Pin />
                {t("cache:pinSelected")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void setPinned([...selected], false)}
              >
                {t("cache:unpinSelected")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() =>
                  setConfirmAction({
                    type: "sources",
                    ids: [...selected],
                  })
                }
              >
                <Trash2 />
                {t("cache:clearSelected")}
              </Button>
            </div>
          </div>
        )}

        {error && (
          <p className="mb-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {stats.length === 0 && !isLoading ? (
          <Empty className="min-h-72 border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Database />
              </EmptyMedia>
              <EmptyTitle>{t("cache:emptyTitle")}</EmptyTitle>
              <EmptyDescription>{t("cache:emptyDescription")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : visibleStats.length === 0 && !isLoading ? (
          <Empty className="min-h-72 border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Search />
              </EmptyMedia>
              <EmptyTitle>{t("cache:noResults")}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <CacheSourceTable
            stats={visibleStats}
            selected={selected}
            formatSize={formatSize}
            onSelectionChange={setSelected}
            onCustomize={setCustomizeFor}
            onTogglePin={(source) =>
              void setPinned([source.id], !source.isPinned)
            }
            onClear={(source) =>
              setConfirmAction({ type: "sources", ids: [source.id] })
            }
          />
        )}

        <ConfirmDialog
          open={confirmAction !== null}
          title={
            confirmAction?.type === "all"
              ? t("archive:clearAll")
              : confirmAction?.type === "unpinned"
                ? t("archive:clearUnpinned")
                : t("cache:clearCache")
          }
          cancelLabel={t("archive:cancel")}
          confirmLabel={t("cache:confirm")}
          destructive
          onCancel={() => setConfirmAction(null)}
          onConfirm={async () => {
            const action = confirmAction;
            setConfirmAction(null);
            if (!action) return;
            if (action.type === "all") await handleClearAll();
            if (action.type === "unpinned") await handleClearUnpinned();
            if (action.type === "sources") {
              await clearSources(action.ids);
              setSelected((current) => {
                const next = new Set(current);
                for (const id of action.ids) next.delete(id);
                return next;
              });
            }
          }}
        >
          <p>
            {confirmAction?.type === "all"
              ? t("cache:clearAllConfirm")
              : confirmAction?.type === "unpinned"
                ? t("cache:clearUnpinnedConfirm")
                : confirmAction?.type === "sources" &&
                    confirmAction.ids.length > 1
                  ? t("cache:clearSelectedConfirm")
                  : t("cache:clearSourceConfirm")}
          </p>
        </ConfirmDialog>

        <CustomizeDialog
          open={customizeFor !== null}
          stats={customizeFor}
          base={basePolicy}
          onClose={() => setCustomizeFor(null)}
          onSave={handleSaveOverride}
        />
      </main>
    </div>
  );
}
