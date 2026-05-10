import { Pin, PinOff, Settings, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/field";
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
      title={t.cache.overridePolicy}
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
            {t.cache.resetToDefaults}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t.archive.cancel}
          </Button>
          <Button
            type="button"
            disabled={widthsError}
            onClick={async () => {
              await onSave(stats.id, buildOverride());
              onClose();
            }}
          >
            {t.cache.confirm}
          </Button>
        </>
      }
    >
      <p className="break-all text-xs text-muted-foreground">
        {stats.originPath}
      </p>
      <div className="grid gap-3">
        <div className="grid gap-1">
          <span className="text-sm font-medium">{t.cache.extractedMode}</span>
          <Select
            value={mode}
            onChange={(event) =>
              setMode(event.target.value as ExtractedMode | "default")
            }
          >
            <option value="default">{t.cache.useDefault}</option>
            <option value="no-cache">{t.cache.extractedModeNoCache}</option>
            <option value="lru-capped">{t.cache.extractedModeLru}</option>
            <option value="unlimited">{t.cache.extractedModeUnlimited}</option>
          </Select>
        </div>
        <Input
          type="number"
          min={0}
          value={minFileSizeMb}
          placeholder={t.cache.extractedMinFileSize}
          onChange={(event) => setMinFileSizeMb(event.target.value)}
        />
        <Input
          type="number"
          min={0}
          value={maxSizeMb}
          placeholder={t.cache.extractedMaxSizePerSource}
          onChange={(event) => setMaxSizeMb(event.target.value)}
        />
        <div className="grid gap-1">
          <span className="text-sm font-medium">
            {t.cache.thumbnailRetention}
          </span>
          <Select
            value={retain}
            onChange={(event) =>
              setRetain(event.target.value as ThumbRetain | "default")
            }
          >
            <option value="default">{t.cache.useDefault}</option>
            <option value="until-source-removed">
              {t.cache.thumbnailRetainUntilRemoved}
            </option>
            <option value="lru-capped">{t.cache.thumbnailRetainLru}</option>
          </Select>
        </div>
        <Input
          type="number"
          min={0}
          value={maxTotalMb}
          placeholder={t.cache.thumbnailMaxTotalSize}
          onChange={(event) => setMaxTotalMb(event.target.value)}
        />
        <Input
          value={widthsText}
          placeholder={t.cache.thumbnailSizesHint}
          onChange={(event) => setWidthsText(event.target.value)}
          aria-invalid={widthsError}
        />
        {widthsError && (
          <p className="text-xs text-destructive">
            Enter at least one positive integer up to 4096, or leave empty.
          </p>
        )}
        <div className="rounded-md bg-muted p-3 font-mono text-xs">
          <p>{t.cache.effectivePolicy}</p>
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
  const [customizeFor, setCustomizeFor] = useState<CacheStats | null>(null);
  const basePolicy = useSettingsStore((s) => s.cachePolicy);

  const refresh = useCallback(async () => {
    if (platform.getCacheStats) {
      setStats(await platform.getCacheStats());
    }
  }, [platform]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const totalSize = stats.reduce(
    (sum, s) => sum + s.thumbCacheSize + s.extractedCacheSize,
    0,
  );

  const handleDelete = useCallback(
    async (id: number) => {
      await platform.clearThumbnails(id);
      await platform.clearExtracted(id);
      refresh();
    },
    [platform, refresh],
  );

  const handleTogglePin = useCallback(
    async (id: number, currentlyPinned: boolean) => {
      if (platform.pinCache) {
        await platform.pinCache(id, !currentlyPinned);
        refresh();
      }
    },
    [platform, refresh],
  );

  const handleClearUnpinned = useCallback(async () => {
    for (const item of stats.filter((s) => !s.isPinned)) {
      await platform.clearThumbnails(item.id);
      await platform.clearExtracted(item.id);
    }
    refresh();
  }, [platform, stats, refresh]);

  const handleClearAll = useCallback(async () => {
    await platform.clearThumbnails();
    await platform.clearExtracted();
    refresh();
  }, [platform, refresh]);

  const handleSaveOverride = useCallback(
    async (sourceId: number, override: SourceOverride | null) => {
      if (platform.setSourcePolicy) {
        await platform.setSourcePolicy(sourceId, override);
        refresh();
      }
    },
    [platform, refresh],
  );

  return (
    <div className="h-full overflow-auto p-6">
      <main className="mx-auto max-w-4xl space-y-5">
        <header>
          <h1 className="text-2xl font-semibold">
            {t.archive.cacheManagement}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.archive.totalCacheSize}: {formatSize(totalSize)}
          </p>
        </header>

        {stats.length === 0 ? (
          <p className="text-muted-foreground">{t.archive.noCache}</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClearUnpinned}
              >
                {t.archive.clearUnpinned}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleClearAll}
              >
                {t.archive.clearAll}
              </Button>
            </div>

            <div className="grid gap-2">
              {stats.map((item) => {
                const hasOverride = !!parseOverride(item.policyOverride);
                return (
                  <article
                    key={item.id}
                    className="grid gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground md:grid-cols-[1fr_auto]"
                  >
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold">
                        [{item.kind}] {item.originPath}
                      </h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t.cache.thumbCache}: {formatSize(item.thumbCacheSize)}{" "}
                        | {t.cache.extractedCache}:{" "}
                        {formatSize(item.extractedCacheSize)} |{" "}
                        {item.entryCount ?? 0} {t.archive.entries}
                        {item.lastAccessed
                          ? ` | ${t.archive.lastAccessed}: ${item.lastAccessed}`
                          : ""}
                        {hasOverride ? " | custom" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant={hasOverride ? "default" : "ghost"}
                        size="icon"
                        title={t.cache.customize}
                        onClick={() => setCustomizeFor(item)}
                      >
                        <Settings />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleTogglePin(item.id, item.isPinned)}
                      >
                        {item.isPinned ? <Pin /> : <PinOff />}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}

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
