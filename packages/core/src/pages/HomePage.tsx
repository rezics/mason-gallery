import { Box, LinearProgress, Typography } from "@mui/material";
import { useRef } from "react";
import DropZone from "@/components/DropZone";
import ImageViewer from "@/components/ImageViewer";
import WaterfallGrid from "@/components/WaterfallGrid";
import { useI18n } from "@/i18n";
import { startScan } from "@/lib/scanActions";
import { useViewerStore } from "@/stores/viewerStore";

export default function HomePage() {
  const t = useI18n();
  const images = useViewerStore((s) => s.images);
  const isScanning = useViewerStore((s) => s.isScanning);
  const totalCount = useViewerStore((s) => s.totalCount);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const hasImages = images.length > 0;
  const showDropZone = !hasImages && !isScanning;
  const progressValue =
    isScanning && totalCount > 0
      ? (images.length / totalCount) * 100
      : undefined;

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {isScanning && (
        <LinearProgress
          variant={
            progressValue !== undefined ? "determinate" : "indeterminate"
          }
          value={progressValue}
        />
      )}

      {showDropZone ? (
        <DropZone onFoldersSelected={startScan} />
      ) : (
        <>
          <Box
            sx={{ px: 2, py: 1, display: "flex", alignItems: "center", gap: 1 }}
          >
            <Typography variant="body2" color="text.secondary">
              {isScanning
                ? totalCount > 0
                  ? t.home.scanProgress
                      .replace("{loaded}", String(images.length))
                      .replace("{total}", String(totalCount))
                  : t.home.scanning
                : t.home.imageCount.replace("{count}", String(images.length))}
            </Typography>
          </Box>
          <Box ref={scrollContainerRef} sx={{ flex: 1, overflow: "auto" }}>
            <WaterfallGrid scrollContainerRef={scrollContainerRef} />
          </Box>
        </>
      )}

      <ImageViewer />
    </Box>
  );
}
