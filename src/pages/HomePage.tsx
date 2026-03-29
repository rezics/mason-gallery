import { Box, LinearProgress, Typography } from "@mui/material";
import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import DropZone from "@/components/DropZone";
import FabActions from "@/components/FabActions";
import ImageViewer from "@/components/ImageViewer";
import WaterfallGrid from "@/components/WaterfallGrid";
import { useI18n } from "@/i18n";
import { refresh, startScan } from "@/lib/scanActions";
import { useAppStore } from "@/stores/appStore";
import { useViewerStore } from "@/stores/viewerStore";
import type { ImageBatch } from "@/types";

export default function HomePage() {
  const t = useI18n();
  const images = useViewerStore((s) => s.images);
  const isScanning = useViewerStore((s) => s.isScanning);
  const appendImages = useViewerStore((s) => s.appendImages);
  const setScanning = useViewerStore((s) => s.setScanning);
  const folders = useAppStore((s) => s.folders);

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
      {folders.length > 0 && <FabActions onRefresh={refresh} />}
    </Box>
  );
}
