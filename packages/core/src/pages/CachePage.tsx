import DeleteIcon from "@mui/icons-material/Delete";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import SettingsIcon from "@mui/icons-material/Settings";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
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
  const [minFileSizeMb, setMinFileSizeMb] = useState<string>(
    existing?.extracted?.minFileSize != null
      ? String(Math.round(existing.extracted.minFileSize / MB))
      : "",
  );
  const [maxSizeMb, setMaxSizeMb] = useState<string>(
    existing?.extracted?.maxSizePerSource != null
      ? String(Math.round(existing.extracted.maxSizePerSource / MB))
      : "",
  );
  const [retain, setRetain] = useState<ThumbRetain | "default">(
    existing?.thumbnails?.retain ?? "default",
  );
  const [maxTotalMb, setMaxTotalMb] = useState<string>(
    existing?.thumbnails?.maxTotalSize != null
      ? String(Math.round(existing.thumbnails.maxTotalSize / MB))
      : "",
  );
  const [widthsText, setWidthsText] = useState<string>(
    existing?.thumbnails?.widths?.join(", ") ?? "",
  );

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

  // Validation: if the user typed text into the widths field but none of the
  // tokens parse to a valid width (positive integer ≤ 4096), surface an
  // explicit error and block save. Empty field = no override (inherit global)
  // and is NOT an error.
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

    if (parsedWidths.length > 0) {
      thumbnails.widths = [...new Set(parsedWidths)];
    }

    const hasExtracted = Object.keys(extracted).length > 0;
    const hasThumbs = Object.keys(thumbnails).length > 0;
    if (!hasExtracted && !hasThumbs) return null;
    const result: SourceOverride = {};
    if (hasExtracted) result.extracted = extracted;
    if (hasThumbs) result.thumbnails = thumbnails;
    return result;
  };

  const preview = effectivePolicy(base, buildOverride());

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t.cache.overridePolicy}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {stats.originPath}
        </Typography>

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {t.cache.extractedMode}
        </Typography>
        <Select
          fullWidth
          size="small"
          value={mode}
          onChange={(e) => setMode(e.target.value as ExtractedMode | "default")}
          sx={{ mb: 2 }}
        >
          <MenuItem value="default">{t.cache.useDefault}</MenuItem>
          <MenuItem value="no-cache">{t.cache.extractedModeNoCache}</MenuItem>
          <MenuItem value="lru-capped">{t.cache.extractedModeLru}</MenuItem>
          <MenuItem value="unlimited">
            {t.cache.extractedModeUnlimited}
          </MenuItem>
        </Select>

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {t.cache.extractedMinFileSize}
        </Typography>
        <TextField
          fullWidth
          size="small"
          type="number"
          value={minFileSizeMb}
          onChange={(e) => setMinFileSizeMb(e.target.value)}
          slotProps={{ htmlInput: { min: 0 } }}
          sx={{ mb: 2 }}
        />

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {t.cache.extractedMaxSizePerSource}
        </Typography>
        <TextField
          fullWidth
          size="small"
          type="number"
          value={maxSizeMb}
          onChange={(e) => setMaxSizeMb(e.target.value)}
          slotProps={{ htmlInput: { min: 0 } }}
          sx={{ mb: 2 }}
        />

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {t.cache.thumbnailRetention}
        </Typography>
        <Select
          fullWidth
          size="small"
          value={retain}
          onChange={(e) => setRetain(e.target.value as ThumbRetain | "default")}
          sx={{ mb: 2 }}
        >
          <MenuItem value="default">{t.cache.useDefault}</MenuItem>
          <MenuItem value="until-source-removed">
            {t.cache.thumbnailRetainUntilRemoved}
          </MenuItem>
          <MenuItem value="lru-capped">{t.cache.thumbnailRetainLru}</MenuItem>
        </Select>

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {t.cache.thumbnailMaxTotalSize}
        </Typography>
        <TextField
          fullWidth
          size="small"
          type="number"
          value={maxTotalMb}
          onChange={(e) => setMaxTotalMb(e.target.value)}
          slotProps={{ htmlInput: { min: 0 } }}
          sx={{ mb: 2 }}
        />

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {t.cache.thumbnailSizes}
        </Typography>
        <TextField
          fullWidth
          size="small"
          value={widthsText}
          placeholder={t.cache.thumbnailSizesHint}
          onChange={(e) => setWidthsText(e.target.value)}
          error={widthsError}
          helperText={
            widthsError
              ? "Enter at least one positive integer ≤ 4096, or leave empty to inherit the global default."
              : undefined
          }
          sx={{ mb: 2 }}
        />

        <Box
          sx={{
            p: 1.5,
            bgcolor: "action.hover",
            borderRadius: 1,
            mt: 1,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {t.cache.effectivePolicy}
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
            extracted.mode: {preview.extracted.mode}
          </Typography>
          {preview.extracted.minFileSize != null && (
            <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
              extracted.minFileSize:{" "}
              {Math.round(preview.extracted.minFileSize / MB)} MB
            </Typography>
          )}
          {preview.extracted.maxSizePerSource != null && (
            <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
              extracted.maxSizePerSource:{" "}
              {Math.round(preview.extracted.maxSizePerSource / MB)} MB
            </Typography>
          )}
          <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
            thumbnails.retain: {preview.thumbnails.retain}
          </Typography>
          {preview.thumbnails.maxTotalSize != null && (
            <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
              thumbnails.maxTotalSize:{" "}
              {Math.round(preview.thumbnails.maxTotalSize / MB)} MB
            </Typography>
          )}
          <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
            thumbnailSizes: [{preview.thumbnailSizes.join(", ")}]
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button
          color="warning"
          onClick={async () => {
            await onSave(stats.id, null);
            onClose();
          }}
        >
          {t.cache.resetToDefaults}
        </Button>
        <Button onClick={onClose}>{t.archive.cancel}</Button>
        <Button
          variant="contained"
          disabled={widthsError}
          onClick={async () => {
            await onSave(stats.id, buildOverride());
            onClose();
          }}
        >
          {t.cache.confirm}
        </Button>
      </DialogActions>
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
      const data = await platform.getCacheStats();
      setStats(data);
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
    const unpinned = stats.filter((s) => !s.isPinned);
    for (const s of unpinned) {
      await platform.clearThumbnails(s.id);
      await platform.clearExtracted(s.id);
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
    <Box sx={{ p: 3, maxWidth: 800, mx: "auto" }}>
      <Typography variant="h5" gutterBottom>
        {t.archive.cacheManagement}
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t.archive.totalCacheSize}: {formatSize(totalSize)}
      </Typography>

      {stats.length === 0 ? (
        <Typography color="text.secondary">{t.archive.noCache}</Typography>
      ) : (
        <>
          <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={handleClearUnpinned}
            >
              {t.archive.clearUnpinned}
            </Button>
            <Button
              variant="outlined"
              size="small"
              color="error"
              onClick={handleClearAll}
            >
              {t.archive.clearAll}
            </Button>
          </Box>

          <List>
            {stats.map((item) => {
              const hasOverride = !!parseOverride(item.policyOverride);
              return (
                <ListItem
                  key={item.id}
                  secondaryAction={
                    <Box>
                      <IconButton
                        onClick={() => setCustomizeFor(item)}
                        size="small"
                        title={t.cache.customize}
                        color={hasOverride ? "primary" : "default"}
                      >
                        <SettingsIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        onClick={() => handleTogglePin(item.id, item.isPinned)}
                        size="small"
                      >
                        {item.isPinned ? (
                          <PushPinIcon fontSize="small" />
                        ) : (
                          <PushPinOutlinedIcon fontSize="small" />
                        )}
                      </IconButton>
                      <IconButton
                        onClick={() => handleDelete(item.id)}
                        size="small"
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  }
                >
                  <ListItemText
                    primary={`[${item.kind}] ${item.originPath}`}
                    secondary={`${t.cache.thumbCache}: ${formatSize(item.thumbCacheSize)} | ${t.cache.extractedCache}: ${formatSize(item.extractedCacheSize)} | ${item.entryCount ?? 0} ${t.archive.entries}${item.lastAccessed ? ` | ${t.archive.lastAccessed}: ${item.lastAccessed}` : ""}${hasOverride ? ` | ⚙` : ""}`}
                  />
                </ListItem>
              );
            })}
          </List>
        </>
      )}

      <CustomizeDialog
        open={customizeFor !== null}
        stats={customizeFor}
        base={basePolicy}
        onClose={() => setCustomizeFor(null)}
        onSave={handleSaveOverride}
      />
    </Box>
  );
}
