import { Box, LinearProgress, Typography } from "@mui/material";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect } from "react";
import DropZone from "@/components/DropZone";
import FabActions from "@/components/FabActions";
import ImageViewer from "@/components/ImageViewer";
import WaterfallGrid from "@/components/WaterfallGrid";
import { useI18n } from "@/i18n";
import { useAppStore } from "@/stores/appStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useViewerStore } from "@/stores/viewerStore";
import type { ImageBatch, ScanParams } from "@/types";

export default function HomePage() {
  const t = useI18n();
  const images = useViewerStore((s) => s.images);
  const isScanning = useViewerStore((s) => s.isScanning);
  const appendImages = useViewerStore((s) => s.appendImages);
  const setScanning = useViewerStore((s) => s.setScanning);
  const resetViewer = useViewerStore((s) => s.reset);
  const folders = useAppStore((s) => s.folders);
  const setFolders = useAppStore((s) => s.setFolders);
  const formats = useSettingsStore((s) => s.formats);
  const sortMethod = useSettingsStore((s) => s.sortMethod);
  const pageSize = useSettingsStore((s) => s.pageSize);

  // Listen for image batches from Rust backend
  useEffect(() => {
    const unlisten = listen<ImageBatch>("images:batch", (event) => {
      const batch = event.payload;
      if (batch.images.length > 0) {
        appendImages(batch.images);
      }
      if (batch.done) {
        setScanning(false);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [appendImages, setScanning]);

  const startScan = useCallback(
    async (paths: string[]) => {
      resetViewer();
      setFolders(paths);
      setScanning(true);

      const params: ScanParams = {
        paths,
        formats,
        page_size: pageSize,
        sort_method: sortMethod,
      };

      try {
        await invoke("scan_directory", { params });
      } catch (e) {
        console.error("Scan failed:", e);
        setScanning(false);
      }
    },
    [formats, sortMethod, pageSize, resetViewer, setFolders, setScanning],
  );

  const handleRefresh = useCallback(() => {
    if (folders.length > 0) {
      startScan(folders);
    }
  }, [folders, startScan]);

  const hasImages = images.length > 0;
  const showDropZone = !hasImages && !isScanning;

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {isScanning && <LinearProgress />}

      {showDropZone ? (
        <DropZone onFoldersSelected={startScan} />
      ) : (
        <>
          <Box
            sx={{ px: 2, py: 1, display: "flex", alignItems: "center", gap: 1 }}
          >
            <Typography variant="body2" color="text.secondary">
              {isScanning
                ? t.home.scanning
                : t.home.imageCount.replace("{count}", String(images.length))}
            </Typography>
          </Box>
          <Box sx={{ flex: 1, overflow: "auto" }}>
            <WaterfallGrid />
          </Box>
        </>
      )}

      <ImageViewer />
      <FabActions onRefresh={handleRefresh} />
    </Box>
  );
}
