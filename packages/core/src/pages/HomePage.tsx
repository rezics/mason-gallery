import { Box, LinearProgress, Typography } from "@mui/material";
import { useRef } from "react";
import DropZone from "@/components/DropZone";
import FabActions from "@/components/FabActions";
import ImageViewer from "@/components/ImageViewer";
import WaterfallGrid from "@/components/WaterfallGrid";
import { useI18n } from "@/i18n";
import { refresh, startScan } from "@/lib/scanActions";
import { useAppStore } from "@/stores/appStore";
import { useViewerStore } from "@/stores/viewerStore";

export default function HomePage() {
  const t = useI18n();
  const images = useViewerStore((s) => s.images);
  const isScanning = useViewerStore((s) => s.isScanning);
  const folders = useAppStore((s) => s.folders);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
          <Box ref={scrollContainerRef} sx={{ flex: 1, overflow: "auto" }}>
            <WaterfallGrid scrollContainerRef={scrollContainerRef} />
          </Box>
        </>
      )}

      <ImageViewer />
      {folders.length > 0 && <FabActions onRefresh={refresh} />}
    </Box>
  );
}
