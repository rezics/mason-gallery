import {
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Info,
  RotateCcw,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Lightbox, {
  type ControllerRef,
  type ZoomRef,
} from "yet-another-react-lightbox";
import Counter from "yet-another-react-lightbox/plugins/counter";
import "yet-another-react-lightbox/plugins/counter.css";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { usePlatform } from "@/context/PlatformContext";
import { useI18n } from "@/i18n";
import {
  type ActionHandlers,
  useInputSuspension,
} from "@/input/useActionInputs";
import {
  ViewerActionsContext,
  ViewerInputPlugin,
} from "@/input/ViewerInputAdapter";
import { applySuccessfulDeleteToSelection } from "@/lib/selectionActions";
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
  className = "",
  disabled = false,
}: {
  title: string;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`yarl__button inline-flex items-center justify-center text-white/85 transition-colors hover:text-white ${className}`}
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
  const controllerRef = useRef<ControllerRef>(null);
  const zoomRef = useRef<ZoomRef>(null);
  const deleting = useRef(false);
  const [zoomed, setZoomed] = useState(false);
  useInputSuspension(confirmOpen || infoOpen);
  useEffect(() => {
    if (!isViewerOpen) {
      setConfirmOpen(false);
      setInfoOpen(false);
      setZoomed(false);
    }
  }, [isViewerOpen]);

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
    if (deleting.current) return;
    deleting.current = true;
    try {
      await platform.deleteFile(img.source);
      if (img.selectableFile) {
        applySuccessfulDeleteToSelection([img.selectableFile.entryKey]);
      }
      removeImage(currentIndex);
      if (showDeleteToast) {
        toast.add({ title: t("viewer:deleteSuccess"), type: "success" });
      }
      if (images.length <= 1) closeViewer();
    } catch (error) {
      console.error("Failed to delete:", error);
    } finally {
      deleting.current = false;
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
    if (!canDelete || deleting.current) return;
    if (confirmDeleteSetting) {
      setConfirmOpen(true);
    } else {
      executeDelete();
    }
  }, [canDelete, confirmDeleteSetting, executeDelete]);

  const handlers: ActionHandlers = {
    "viewer.previous": () => controllerRef.current?.prev(),
    "viewer.next": () => controllerRef.current?.next(),
    "viewer.zoomIn": () => zoomRef.current?.zoomIn(),
    "viewer.zoomOut": () => zoomRef.current?.zoomOut(),
    "viewer.resetZoom": () => zoomRef.current?.changeZoom(1),
    "viewer.toggleZoom": () => {
      const zoom = zoomRef.current;
      if (zoom)
        zoom.changeZoom(
          zoom.zoom >= zoom.maxZoom
            ? 1
            : zoom.zoom * Math.max(Math.sqrt(zoom.maxZoom), 2),
        );
    },
    "viewer.close": closeViewer,
    "viewer.info": () => setInfoOpen(true),
    ...(canDelete ? { "viewer.delete": requestDelete } : {}),
    ...(canReveal
      ? {
          "viewer.reveal": () =>
            currentImage && platform.revealFile?.(currentImage.source),
        }
      : {}),
  };
  const wheelZoom = (delta: number, event: WheelEvent) => {
    const zoom = zoomRef.current;
    const container =
      event.currentTarget instanceof Element
        ? event.currentTarget.getBoundingClientRect()
        : undefined;
    if (zoom)
      zoom.changeZoom(
        zoom.zoom * Math.min(1 + Math.abs(delta / 100), 2) ** -Math.sign(delta),
        true,
        container ? event.clientX - container.left - container.width / 2 : 0,
        container ? event.clientY - container.top - container.height / 2 : 0,
      );
  };

  if (!isViewerOpen) return null;

  const toolbarButtons: (string | ReactNode)[] = [];

  if (currentImage) {
    toolbarButtons.push(
      <ViewerButton
        key="info"
        title={t("viewer:info")}
        onClick={handlers["viewer.info"]}
      >
        <Info />
      </ViewerButton>,
    );

    if (canReveal) {
      toolbarButtons.push(
        <ViewerButton
          key="folder"
          title={t("viewer:revealInFolder")}
          onClick={handlers["viewer.reveal"]}
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
          onClick={handlers["viewer.delete"]}
        >
          <Trash2 />
        </ViewerButton>,
      );
    }
  }

  toolbarButtons.push(
    <ViewerButton
      key="reset"
      title={t("settings:action_viewer_resetZoom")}
      onClick={handlers["viewer.resetZoom"]}
    >
      <RotateCcw />
    </ViewerButton>,
    "close",
  );

  return (
    <>
      <ViewerActionsContext.Provider
        value={{
          handlers,
          zoomed,
          isZoomed: () => (zoomRef.current?.zoom ?? 1) > 1,
          wheelZoom,
        }}
      >
        <Lightbox
          open={isViewerOpen}
          close={closeViewer}
          slides={slides}
          index={currentIndex}
          on={{
            view: ({ index }) => setCurrentIndex(index),
            zoom: ({ zoom }) => setZoomed(zoom > 1),
          }}
          plugins={[Counter, Zoom, ViewerInputPlugin]}
          zoom={{ ref: zoomRef, scrollToZoom: false, doubleClickDelay: 0 }}
          controller={{ ref: controllerRef, closeOnBackdropClick: true }}
          toolbar={{ buttons: toolbarButtons }}
          render={{
            buttonPrev: () => (
              <ViewerButton
                className="yarl__navigation_prev"
                title={t("settings:action_viewer_previous")}
                onClick={handlers["viewer.previous"]}
              >
                <ChevronLeft />
              </ViewerButton>
            ),
            buttonNext: () => (
              <ViewerButton
                className="yarl__navigation_next"
                title={t("settings:action_viewer_next")}
                onClick={handlers["viewer.next"]}
              >
                <ChevronRight />
              </ViewerButton>
            ),
            buttonClose: () => (
              <ViewerButton
                key="close"
                title={t("settings:action_viewer_close")}
                onClick={handlers["viewer.close"]}
              >
                <X />
              </ViewerButton>
            ),
            buttonZoom: (zoom) => (
              <Fragment key="zoom">
                <ViewerButton
                  title={t("settings:action_viewer_zoomIn")}
                  disabled={zoom.disabled || zoom.zoom >= zoom.maxZoom}
                  onClick={handlers["viewer.zoomIn"]}
                >
                  <ZoomIn />
                </ViewerButton>
                <ViewerButton
                  title={t("settings:action_viewer_zoomOut")}
                  disabled={zoom.disabled || zoom.zoom <= zoom.minZoom}
                  onClick={handlers["viewer.zoomOut"]}
                >
                  <ZoomOut />
                </ViewerButton>
              </Fragment>
            ),
          }}
        />
      </ViewerActionsContext.Provider>

      {currentImage && (
        <Dialog
          open={infoOpen}
          title={t("viewer:info")}
          onClose={() => setInfoOpen(false)}
        >
          <p className="break-all">
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
        <p className="break-all">{getFileName(currentImage?.source ?? "")}</p>
      </ConfirmDialog>
    </>
  );
}
