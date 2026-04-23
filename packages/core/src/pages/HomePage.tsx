import { Box, LinearProgress, TextField, Typography } from "@mui/material";
import type { Positioner } from "masonic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DropZone from "@/components/DropZone";
import FolderSidebar from "@/components/FolderSidebar";
import ImageViewer from "@/components/ImageViewer";
import MigrationConfirmDialog from "@/components/MigrationConfirmDialog";
import PasswordDialog from "@/components/PasswordDialog";
import SolidArchiveWarningDialog from "@/components/SolidArchiveWarningDialog";
import WaterfallGrid from "@/components/WaterfallGrid";
import { usePlatform } from "@/context/PlatformContext";
import { useI18n } from "@/i18n";
import {
  executeArchiveScan,
  expandLockedArchive,
  startArchiveScan,
  startScan,
} from "@/lib/scanActions";
import { useAppStore } from "@/stores/appStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useViewerStore } from "@/stores/viewerStore";

function useApproxScrollIndex(
  scrollContainerRef: React.RefObject<HTMLElement | null>,
  positionerRef: React.RefObject<{
    positioner: Positioner;
    columnCount: number;
  } | null>,
  itemCount: number,
) {
  const [currentIndex, setCurrentIndex] = useState(1);
  const rafRef = useRef(0);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const update = () => {
      const p = positionerRef.current;
      if (!p || itemCount === 0) {
        setCurrentIndex(1);
        return;
      }
      const scrollTop = el.scrollTop;
      const totalHeight = p.positioner.shortestColumn();
      if (totalHeight <= 0) {
        setCurrentIndex(1);
        return;
      }
      const avgHeight = totalHeight / (itemCount / p.columnCount);
      const row = scrollTop / avgHeight;
      const idx = Math.round(row * p.columnCount) + 1;
      setCurrentIndex(Math.max(1, Math.min(idx, itemCount)));
    };

    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        update();
        rafRef.current = 0;
      });
    };

    update();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, [scrollContainerRef, positionerRef, itemCount]);

  return currentIndex;
}

export default function HomePage() {
  const t = useI18n();
  const allImages = useViewerStore((s) => s.images);
  const isScanning = useViewerStore((s) => s.isScanning);
  const totalCount = useViewerStore((s) => s.totalCount);
  const showGridPosition = useSettingsStore((s) => s.showGridPosition);
  const selectedFolder = useAppStore((s) => s.selectedFolder);

  const platform = usePlatform();
  const archivePasswordNeeded = useAppStore((s) => s.archivePasswordNeeded);
  const archiveSolidWarning = useAppStore((s) => s.archiveSolidWarning);
  const archiveMigrationCandidate = useAppStore(
    (s) => s.archiveMigrationCandidate,
  );
  const [passwordError, setPasswordError] = useState("");

  const images = useMemo(() => {
    if (!selectedFolder) {
      return allImages.map((img, i) => ({ ...img, globalIndex: i }));
    }
    const prefix = `${selectedFolder}/`;
    return allImages
      .map((img, i) => ({ ...img, globalIndex: i }))
      .filter((img) => img.relativePath.startsWith(prefix));
  }, [allImages, selectedFolder]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const positionerRef = useRef<{
    positioner: Positioner;
    columnCount: number;
  } | null>(null);

  const handlePositionerReady = useCallback(
    (positioner: Positioner, columnCount: number) => {
      positionerRef.current = { positioner, columnCount };
    },
    [],
  );

  const currentIndex = useApproxScrollIndex(
    scrollContainerRef,
    positionerRef,
    images.length,
  );

  const [isJumpInputOpen, setIsJumpInputOpen] = useState(false);
  const [jumpValue, setJumpValue] = useState("");

  const scrollToIndex = useCallback(
    (index: number) => {
      const p = positionerRef.current;
      const el = scrollContainerRef.current;
      if (!p || !el) return;
      const clamped = Math.max(0, Math.min(index, images.length - 1));
      const position = p.positioner.get(clamped);
      if (position) {
        const containerHeight = el.clientHeight;
        const scrollTop =
          position.top - (containerHeight - position.height) / 2;
        el.scrollTo(0, Math.max(0, scrollTop));
      } else {
        // Estimate position from average height
        const avgHeight = p.positioner.shortestColumn() / p.positioner.size();
        el.scrollTo(0, Math.max(0, avgHeight * clamped));
      }
    },
    [images.length],
  );

  const handleJumpConfirm = useCallback(() => {
    const n = Number.parseInt(jumpValue, 10);
    if (!Number.isNaN(n)) {
      const clamped = Math.max(1, Math.min(n, images.length));
      scrollToIndex(clamped - 1);
    }
    setIsJumpInputOpen(false);
    setJumpValue("");
  }, [jumpValue, images.length, scrollToIndex]);

  // Ctrl+G shortcut to open jump input
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "g" && images.length > 0 && showGridPosition) {
        e.preventDefault();
        setIsJumpInputOpen(true);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [images.length, showGridPosition]);

  const hasImages = allImages.length > 0;
  const showDropZone = !hasImages && !isScanning;
  const progressValue =
    isScanning && totalCount > 0
      ? (allImages.length / totalCount) * 100
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
        <DropZone
          onFoldersSelected={startScan}
          onArchiveSelected={startArchiveScan}
        />
      ) : (
        <>
          <Box
            sx={{ px: 2, py: 1, display: "flex", alignItems: "center", gap: 1 }}
          >
            {isScanning ? (
              <Typography variant="body2" color="text.secondary">
                {totalCount > 0
                  ? t.home.scanProgress
                      .replace("{loaded}", String(allImages.length))
                      .replace("{total}", String(totalCount))
                  : t.home.scanning}
              </Typography>
            ) : showGridPosition && images.length > 0 ? (
              isJumpInputOpen ? (
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <TextField
                    size="small"
                    type="number"
                    autoFocus
                    value={jumpValue}
                    onChange={(e) => setJumpValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleJumpConfirm();
                      if (e.key === "Escape") {
                        setIsJumpInputOpen(false);
                        setJumpValue("");
                      }
                    }}
                    onBlur={() => {
                      setIsJumpInputOpen(false);
                      setJumpValue("");
                    }}
                    placeholder={String(currentIndex)}
                    slotProps={{
                      htmlInput: {
                        min: 1,
                        max: images.length,
                        style: { padding: "2px 8px" },
                      },
                    }}
                    sx={{ width: 80 }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    / {images.length}
                  </Typography>
                </Box>
              ) : (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    cursor: "pointer",
                    userSelect: "none",
                    "&:hover": { color: "text.primary" },
                  }}
                  onClick={() => setIsJumpInputOpen(true)}
                  title={t.home.goToImage}
                >
                  ~{currentIndex} / {images.length}
                </Typography>
              )
            ) : (
              <Typography variant="body2" color="text.secondary">
                {t.home.imageCount.replace("{count}", String(images.length))}
              </Typography>
            )}
          </Box>
          <Box sx={{ flex: 1, display: "flex", overflow: "hidden" }}>
            <FolderSidebar />
            <Box ref={scrollContainerRef} sx={{ flex: 1, overflow: "auto" }}>
              <WaterfallGrid
                scrollContainerRef={scrollContainerRef}
                images={images}
                onPositionerReady={handlePositionerReady}
              />
            </Box>
          </Box>
        </>
      )}

      <ImageViewer />

      {/* Archive Password Dialog */}
      <PasswordDialog
        open={!!archivePasswordNeeded}
        archivePath={archivePasswordNeeded ?? ""}
        error={passwordError}
        onSubmit={async (password, remember) => {
          const path = archivePasswordNeeded;
          if (!path) return;

          try {
            if (platform.unlockArchive) {
              const { passwordStorageMode } = useSettingsStore.getState();
              await platform.unlockArchive(
                path,
                password,
                remember,
                passwordStorageMode,
              );
            }
            const placeholderSource = `archive:///${path}`;
            const hasPlaceholder = useViewerStore
              .getState()
              .images.some(
                (img) => img.locked && img.source === placeholderSource,
              );
            useAppStore.setState({ archivePasswordNeeded: null });
            setPasswordError("");
            if (hasPlaceholder) {
              expandLockedArchive(path, password).catch(() => {});
            } else {
              executeArchiveScan(path, password);
            }
          } catch {
            setPasswordError(t.archive.wrongPassword);
          }
        }}
        onCancel={() => {
          useAppStore.setState({ archivePasswordNeeded: null });
          setPasswordError("");
        }}
      />

      {/* Migration Confirm Dialog */}
      <MigrationConfirmDialog
        open={!!archiveMigrationCandidate}
        oldPath={archiveMigrationCandidate?.oldPath ?? ""}
        newPath={archiveMigrationCandidate?.newPath ?? ""}
        onUseCache={async () => {
          const candidate = archiveMigrationCandidate;
          if (!candidate || !platform.confirmMigration) return;
          await platform.confirmMigration(
            candidate.archiveId,
            candidate.newPath,
          );
          useAppStore.setState({ archiveMigrationCandidate: null });
          executeArchiveScan(candidate.newPath);
        }}
        onScanFresh={() => {
          const candidate = archiveMigrationCandidate;
          useAppStore.setState({ archiveMigrationCandidate: null });
          if (candidate) {
            executeArchiveScan(candidate.newPath);
          }
        }}
      />

      {/* Solid Archive Warning */}
      <SolidArchiveWarningDialog
        open={!!archiveSolidWarning}
        onContinue={() => {
          const path = archiveSolidWarning;
          useAppStore.setState({ archiveSolidWarning: null });
          if (path) {
            executeArchiveScan(path);
          }
        }}
        onCancel={() => {
          useAppStore.setState({ archiveSolidWarning: null });
        }}
      />
    </Box>
  );
}
