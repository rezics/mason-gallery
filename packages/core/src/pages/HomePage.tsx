import type { Positioner } from "masonic";
import type { RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DropZone from "@/components/DropZone";
import FolderSidebar from "@/components/FolderSidebar";
import ImageViewer from "@/components/ImageViewer";
import MasterPasswordDialog from "@/components/MasterPasswordDialog";
import MigrationConfirmDialog from "@/components/MigrationConfirmDialog";
import PasswordDialog from "@/components/PasswordDialog";
import SelectionActionBar from "@/components/SelectionActionBar";
import SolidArchiveWarningDialog from "@/components/SolidArchiveWarningDialog";
import { Progress } from "@/components/ui/progress";
import WaterfallGrid from "@/components/WaterfallGrid";
import { usePlatform } from "@/context/PlatformContext";
import { useI18n } from "@/i18n";
import {
  executeArchiveScan,
  expandLockedArchive,
  startArchiveScan,
  startScan,
} from "@/lib/scanActions";
import { visibleSelectableIdentities } from "@/lib/selectionActions";
import { useAppStore } from "@/stores/appStore";
import { useSelectionStore } from "@/stores/selectionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useViewerStore } from "@/stores/viewerStore";

function useApproxScrollIndex(
  scrollContainerRef: RefObject<HTMLElement | null>,
  positionerRef: RefObject<{
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
  const infoLoaded = useViewerStore((s) => s.infoLoaded);
  const infoTotal = useViewerStore((s) => s.infoTotal);
  const thumbGenerated = useViewerStore((s) => s.thumbGenerated);
  const thumbTotal = useViewerStore((s) => s.thumbTotal);
  const showGridPosition = useSettingsStore((s) => s.showGridPosition);
  const selectedFolder = useAppStore((s) => s.selectedFolder);

  const platform = usePlatform();
  const archivePasswordNeeded = useAppStore((s) => s.archivePasswordNeeded);
  const archiveMasterPasswordNeeded = useAppStore(
    (s) => s.archiveMasterPasswordNeeded,
  );
  const archiveSolidWarning = useAppStore((s) => s.archiveSolidWarning);
  const archiveMigrationCandidate = useAppStore(
    (s) => s.archiveMigrationCandidate,
  );
  const [passwordError, setPasswordError] = useState("");
  const [masterPasswordError, setMasterPasswordError] = useState("");
  const [isMasterPasswordSetupOpen, setIsMasterPasswordSetupOpen] =
    useState(false);
  const pendingArchivePasswordRef = useRef<{
    path: string;
    password: string;
  } | null>(null);

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

  // Ctrl+G shortcut to open jump input; multi-select Escape / Ctrl+A.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "g" && images.length > 0 && showGridPosition) {
        e.preventDefault();
        setIsJumpInputOpen(true);
        return;
      }

      const target = e.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        Boolean(target?.isContentEditable);
      if (typing || isJumpInputOpen) return;

      const selection = useSelectionStore.getState();
      if (e.key === "Escape" && selection.modeEnabled) {
        e.preventDefault();
        selection.setModeEnabled(false);
        return;
      }
      if (
        selection.modeEnabled &&
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "a"
      ) {
        e.preventDefault();
        selection.selectMany(visibleSelectableIdentities(images));
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [images, images.length, isJumpInputOpen, showGridPosition]);

  const hasImages = allImages.length > 0;
  const showDropZone = !hasImages && !isScanning;
  const progressValue =
    isScanning && totalCount > 0
      ? (allImages.length / totalCount) * 100
      : undefined;

  const resumeArchive = useCallback((path: string, password?: string) => {
    const placeholderSource = `archive:///${path}`;
    const hasPlaceholder = useViewerStore
      .getState()
      .images.some((img) => img.locked && img.source === placeholderSource);

    pendingArchivePasswordRef.current = null;
    setIsMasterPasswordSetupOpen(false);
    setPasswordError("");
    setMasterPasswordError("");
    useAppStore.setState({
      archivePasswordNeeded: null,
      archiveMasterPasswordNeeded: null,
    });

    if (hasPlaceholder) {
      void expandLockedArchive(path, password).catch(() => {});
    } else {
      void executeArchiveScan(path, password);
    }
  }, []);

  const handleArchivePasswordSubmit = useCallback(
    async (password: string, remember: boolean) => {
      const path = archivePasswordNeeded;
      if (!path) return;

      const { passwordStorageMode } = useSettingsStore.getState();
      try {
        if (platform.unlockArchive) {
          await platform.unlockArchive(
            path,
            password,
            remember,
            passwordStorageMode,
          );
        }
        resumeArchive(path, platform.unlockArchive ? undefined : password);
      } catch (error) {
        const message = String(error);
        if (message.includes("MasterPasswordRequired")) {
          pendingArchivePasswordRef.current = { path, password };
          setPasswordError("");
          setMasterPasswordError("");
          setIsMasterPasswordSetupOpen(true);
          useAppStore.setState({ archivePasswordNeeded: null });
          return;
        }

        setPasswordError(
          message.includes("WrongPassword")
            ? t("archive:wrongPassword")
            : t("archive:passwordStorageFailed"),
        );
      }
    },
    [archivePasswordNeeded, platform, resumeArchive, t],
  );

  const handleMasterPasswordSubmit = useCallback(
    async (masterPassword: string): Promise<boolean> => {
      const pending = pendingArchivePasswordRef.current;
      if (isMasterPasswordSetupOpen && pending) {
        if (!platform.unlockArchive) return false;
        try {
          await platform.unlockArchive(
            pending.path,
            pending.password,
            true,
            "master",
            masterPassword,
          );
          resumeArchive(pending.path);
          return true;
        } catch (error) {
          console.error("Failed to save encrypted archive password:", error);
          setMasterPasswordError(t("archive:passwordStorageFailed"));
          return false;
        }
      }

      const path = archiveMasterPasswordNeeded;
      if (!path || !platform.unlockArchiveWithMasterPassword) return false;
      try {
        await platform.unlockArchiveWithMasterPassword(path, masterPassword);
        resumeArchive(path);
        return true;
      } catch (error) {
        const message = String(error);
        if (
          message.includes("WrongPassword") ||
          message.includes("MasterPasswordNotStored")
        ) {
          setMasterPasswordError("");
          useAppStore.setState({
            archiveMasterPasswordNeeded: null,
            archivePasswordNeeded: path,
          });
          return true;
        }

        setMasterPasswordError(t("archive:wrongMasterPassword"));
        return false;
      }
    },
    [
      archiveMasterPasswordNeeded,
      isMasterPasswordSetupOpen,
      platform,
      resumeArchive,
      t,
    ],
  );

  const handleMasterPasswordCancel = useCallback(() => {
    const pending = pendingArchivePasswordRef.current;
    pendingArchivePasswordRef.current = null;
    setIsMasterPasswordSetupOpen(false);
    setMasterPasswordError("");

    if (pending) {
      useAppStore.setState({ archivePasswordNeeded: pending.path });
      return;
    }
    useAppStore.setState({ archiveMasterPasswordNeeded: null });
  }, []);

  return (
    <div className="flex h-full flex-col">
      {isScanning && (
        <Progress
          aria-label={t("home:scanning")}
          value={progressValue ?? null}
          className="gap-0 [&_[data-slot=progress-track]]:h-1 [&_[data-slot=progress-track]]:rounded-none"
        />
      )}

      {showDropZone ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <DropZone
            onFoldersSelected={(paths) => {
              void startScan(paths, { libraryEffect: "ensure" });
            }}
            onArchiveSelected={(path) => {
              void startArchiveScan(path, { libraryEffect: "ensure" });
            }}
          />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 px-4 py-2">
            {isScanning ? (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span>
                  {totalCount > 0
                    ? t("home:scanProgress", {
                        loaded: allImages.length,
                        total: totalCount,
                      })
                    : t("home:scanning")}
                </span>
                {infoTotal > 0 && (
                  <span>
                    {" "}
                    -{" "}
                    {t("home:infoProgress", {
                      loaded: infoLoaded,
                      total: infoTotal,
                    })}
                  </span>
                )}
                {thumbTotal > 0 && (
                  <span>
                    {" "}
                    -{" "}
                    {t("home:thumbProgress", {
                      generated: thumbGenerated,
                      total: thumbTotal,
                    })}
                  </span>
                )}
              </div>
            ) : showGridPosition && images.length > 0 ? (
              isJumpInputOpen ? (
                <div className="flex items-center gap-2">
                  <input
                    className="h-7 w-20 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    type="number"
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
                    min={1}
                    max={images.length}
                  />
                  <span className="text-sm text-muted-foreground">
                    / {images.length}
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  className="select-none text-sm text-muted-foreground hover:text-foreground"
                  onClick={() => setIsJumpInputOpen(true)}
                  title={t("home:goToImage")}
                >
                  ~{currentIndex} / {images.length}
                </button>
              )
            ) : (
              <span className="text-sm text-muted-foreground">
                {t("home:imageCount", { count: images.length })}
              </span>
            )}
            <SelectionActionBar visibleCount={images.length} />
          </div>
          <div className="flex flex-1 overflow-hidden">
            <FolderSidebar />
            <div ref={scrollContainerRef} className="flex-1 overflow-auto">
              <WaterfallGrid
                scrollContainerRef={scrollContainerRef}
                images={images}
                onPositionerReady={handlePositionerReady}
              />
            </div>
          </div>
        </>
      )}

      <ImageViewer />

      {/* Archive Password Dialog */}
      <PasswordDialog
        open={!!archivePasswordNeeded}
        archivePath={archivePasswordNeeded ?? ""}
        error={passwordError}
        onSubmit={handleArchivePasswordSubmit}
        onCancel={() => {
          useAppStore.setState({ archivePasswordNeeded: null });
          setPasswordError("");
        }}
      />

      <MasterPasswordDialog
        open={isMasterPasswordSetupOpen || !!archiveMasterPasswordNeeded}
        mode={isMasterPasswordSetupOpen ? "set" : "enter"}
        error={masterPasswordError}
        onSubmit={handleMasterPasswordSubmit}
        onCancel={handleMasterPasswordCancel}
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
    </div>
  );
}
