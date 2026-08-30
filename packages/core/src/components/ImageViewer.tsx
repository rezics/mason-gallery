import { FolderOpen, Info, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Counter from "yet-another-react-lightbox/plugins/counter";
import "yet-another-react-lightbox/plugins/counter.css";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
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
  const [infoOpen, setInfoOpen] = useState(false);

  const currentImage = images[currentIndex];
  const canDelete =
    platform.capabilities.canDeleteFiles && !!platform.deleteFile;
  const canReveal =
    platform.capabilities.canRevealFile && !!platform.revealFile;

  const slides = useMemo(
    () =>
      images.map((img) => ({
        src: platform.getImageUrl(img.source),
        width: img.width ?? undefined,
        height: img.height ?? undefined,
      })),
    [images, platform],
  );

  const executeDelete = useCallback(async () => {
    if (!canDelete || !platform.deleteFile) return;
    const img = images[currentIndex];
    if (!img) return;
    try {
      await platform.deleteFile(img.source);
      removeImage(currentIndex);
      if (showDeleteToast) {
        toast.add({ title: t("viewer:deleteSuccess"), type: "success" });
      }
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
    t,
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

      {currentImage && (
        <Dialog
          open={infoOpen}
          title={t("viewer:info")}
          onClose={() => setInfoOpen(false)}
        >
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
        </Dialog>
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
    </>
  );
}
