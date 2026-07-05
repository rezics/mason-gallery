import { FolderOpen, Info, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Counter from "yet-another-react-lightbox/plugins/counter";
import "yet-another-react-lightbox/plugins/counter.css";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { usePlatform } from "@/context/PlatformContext";
import { useI18n } from "@/i18n";
import { useSettingsStore } from "@/stores/settingsStore";
import { useViewerStore } from "@/stores/viewerStore";

function getFileName(source: string): string {
  const sep = Math.max(source.lastIndexOf("/"), source.lastIndexOf("\\"));
  return source.substring(sep + 1);
}

function ViewerButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="yarl__button inline-flex items-center justify-center text-white/85 transition-colors hover:text-white"
      title={title}
      aria-label={title}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function ImageViewer() {
  const platform = usePlatform();
  const t = useI18n();
  const images = useViewerStore((s) => s.images);
  const currentIndex = useViewerStore((s) => s.currentIndex);
  const isViewerOpen = useViewerStore((s) => s.isViewerOpen);
  const closeViewer = useViewerStore((s) => s.closeViewer);
  const setCurrentIndex = useViewerStore((s) => s.setCurrentIndex);
  const removeImage = useViewerStore((s) => s.removeImage);
  const confirmDeleteSetting = useSettingsStore((s) => s.confirmDelete);
  const showDeleteToast = useSettingsStore((s) => s.showDeleteToast);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const currentImage = images[currentIndex];
  const canDelete =
    platform.capabilities.canDeleteFiles && !!platform.deleteFile;
  const canReveal =
    platform.capabilities.canRevealFile && !!platform.revealFile;

  const slides = images.map((img) => ({
    src: platform.getImageUrl(img.source),
    width: img.width ?? undefined,
    height: img.height ?? undefined,
  }));

  const executeDelete = useCallback(async () => {
    if (!canDelete || !platform.deleteFile) return;
    const img = images[currentIndex];
    if (!img) return;
    try {
      await platform.deleteFile(img.source);
      removeImage(currentIndex);
      if (showDeleteToast) setToastOpen(true);
      if (images.length <= 1) closeViewer();
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  }, [
    canDelete,
    platform.deleteFile,
    images,
    currentIndex,
    removeImage,
    closeViewer,
    showDeleteToast,
  ]);

  const requestDelete = useCallback(() => {
    if (!canDelete) return;
    if (confirmDeleteSetting) {
      setConfirmOpen(true);
    } else {
      executeDelete();
    }
  }, [canDelete, confirmDeleteSetting, executeDelete]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Delete" && canDelete) {
        requestDelete();
      }
    },
    [canDelete, requestDelete],
  );

  useEffect(() => {
    if (!isViewerOpen) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isViewerOpen, handleKeyDown]);

  useEffect(() => {
    if (!toastOpen) return;
    const id = window.setTimeout(() => setToastOpen(false), 3000);
    return () => window.clearTimeout(id);
  }, [toastOpen]);

  if (!isViewerOpen) return null;

  const toolbarButtons: (string | ReactNode)[] = [];

  if (currentImage) {
    toolbarButtons.push(
      <ViewerButton
        key="info"
        title={t("viewer:info")}
        onClick={() => setInfoOpen((open) => !open)}
      >
        <Info />
      </ViewerButton>,
    );

    if (canReveal) {
      toolbarButtons.push(
        <ViewerButton
          key="folder"
          title={t("viewer:revealInFolder")}
          onClick={() => platform.revealFile?.(currentImage.source)}
        >
          <FolderOpen />
        </ViewerButton>,
      );
    }

    if (canDelete) {
      toolbarButtons.push(
        <ViewerButton
          key="delete"
          title={t("viewer:deleteConfirm")}
          onClick={requestDelete}
        >
          <Trash2 />
        </ViewerButton>,
      );
    }
  }

  toolbarButtons.push("close");

  return (
    <>
      <Lightbox
        open={isViewerOpen}
        close={closeViewer}
        slides={slides}
        index={currentIndex}
        on={{
          view: ({ index }) => setCurrentIndex(index),
        }}
        plugins={[Counter, Zoom]}
        zoom={{ scrollToZoom: true }}
        controller={{ closeOnBackdropClick: true }}
        toolbar={{ buttons: toolbarButtons }}
      />

      {infoOpen && currentImage && (
        <div className="fixed right-4 top-16 z-[10000] max-w-md rounded-lg border border-border bg-popover p-4 text-sm text-popover-foreground shadow-xl">
          <div className="mb-2 flex items-center justify-between gap-4">
            <h2 className="font-semibold">{t("viewer:info")}</h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setInfoOpen(false)}
            >
              {t("actions:close")}
            </Button>
          </div>
          <p>
            {t("viewer:fileName")}: {getFileName(currentImage.source)}
          </p>
          {currentImage.width && currentImage.height && (
            <p>
              {t("viewer:dimensions")}: {currentImage.width} x{" "}
              {currentImage.height}
            </p>
          )}
          <p className="break-all text-muted-foreground">
            {t("viewer:filePath")}: {currentImage.source}
          </p>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={t("viewer:deleteConfirm")}
        cancelLabel={t("actions:close")}
        confirmLabel="OK"
        destructive
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          executeDelete();
        }}
      >
        <p>{getFileName(currentImage?.source ?? "")}</p>
      </ConfirmDialog>

      {toastOpen && (
        <div className="fixed bottom-4 right-4 z-[10000] rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg">
          {t("viewer:deleteSuccess")}
        </div>
      )}
    </>
  );
}
