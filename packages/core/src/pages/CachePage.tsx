import DeleteIcon from "@mui/icons-material/Delete";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import {
  Box,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { usePlatform } from "@/context/PlatformContext";
import { useI18n } from "@/i18n";
import type { CacheStats } from "@/types/platform";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function CachePage() {
  const t = useI18n();
  const platform = usePlatform();
  const [stats, setStats] = useState<CacheStats[]>([]);

  const refresh = useCallback(async () => {
    if (platform.getCacheStats) {
      const data = await platform.getCacheStats();
      setStats(data);
    }
  }, [platform]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const totalSize = stats.reduce((sum, s) => sum + s.cacheSize, 0);

  const handleDelete = useCallback(
    async (id: number) => {
      if (platform.clearCache) {
        await platform.clearCache(id);
        refresh();
      }
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
    if (!platform.clearCache) return;
    const unpinned = stats.filter((s) => !s.isPinned);
    for (const s of unpinned) {
      await platform.clearCache(s.id);
    }
    refresh();
  }, [platform, stats, refresh]);

  const handleClearAll = useCallback(async () => {
    if (platform.clearCache) {
      await platform.clearCache();
      refresh();
    }
  }, [platform, refresh]);

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
            {stats.map((item) => (
              <ListItem
                key={item.id}
                secondaryAction={
                  <Box>
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
                  primary={item.filename}
                  secondary={`${formatSize(item.cacheSize)} | ${item.entryCount ?? 0} ${t.archive.entries}${item.lastAccessed ? ` | ${t.archive.lastAccessed}: ${item.lastAccessed}` : ""}`}
                />
              </ListItem>
            ))}
          </List>
        </>
      )}
    </Box>
  );
}
