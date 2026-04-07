import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import FolderOpenOutlined from "@mui/icons-material/FolderOpenOutlined";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogTitle,
  IconButton,
  Popover,
  Snackbar,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Counter from "yet-another-react-lightbox/plugins/counter";
import "yet-another-react-lightbox/plugins/counter.css";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import { usePlatform } from "@/context/PlatformContext";
import { useI18n } from "@/i18n";
import { useSettingsStore } from "@/stores/settingsStore";
import { useViewerStore } from "@/stores/viewerStore";

function getFileName(source: string): string {
  const sep = Math.max(source.lastIndexOf("/"), source.lastIndexOf("\\"));
  return source.substring(sep + 1);
}

const toolbarButtonSx = { color: "rgba(255,255,255,0.8)" } as const;

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
  const [snackOpen, setSnackOpen] = useState(false);
  const [infoAnchor, setInfoAnchor] = useState<HTMLElement | null>(null);

  const currentImage = images[currentIndex];

  const slides = images.map((img) => ({
    src: platform.getImageUrl(img.source),
    width: img.width ?? undefined,
    height: img.height ?? undefined,
  }));

  const executeDelete = useCallback(async () => {
    if (!platform.capabilities.canDeleteFiles) return;
    const img = images[currentIndex];
    if (!img) return;
    try {
      await platform.deleteFile(img.source);
      removeImage(currentIndex);
      if (showDeleteToast) {
        setSnackOpen(true);
      }
      if (images.length <= 1) {
        closeViewer();
      }
    } catch (e) {
      console.error("Failed to delete:", e);
    }
  }, [
    platform,
    images,
    currentIndex,
    removeImage,
    closeViewer,
    showDeleteToast,
  ]);

  const requestDelete = useCallback(() => {
    if (!platform.capabilities.canDeleteFiles) return;
    if (confirmDeleteSetting) {
      setConfirmOpen(true);
    } else {
      executeDelete();
    }
  }, [
    platform.capabilities.canDeleteFiles,
    confirmDeleteSetting,
    executeDelete,
  ]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Delete" && platform.capabilities.canDeleteFiles) {
        requestDelete();
      }
    },
    [platform.capabilities.canDeleteFiles, requestDelete],
  );

  useEffect(() => {
    if (!isViewerOpen) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isViewerOpen, handleKeyDown]);

  if (!isViewerOpen) return null;

  const toolbarButtons: (string | React.ReactNode)[] = [];

  if (currentImage) {
    toolbarButtons.push(
      <Tooltip key="info" title={t.viewer.info}>
        <IconButton
          className="yarl__button"
          sx={toolbarButtonSx}
          onMouseEnter={(e) => setInfoAnchor(e.currentTarget)}
          onMouseLeave={() => setInfoAnchor(null)}
        >
          <InfoOutlined />
        </IconButton>
      </Tooltip>,
    );

    if (platform.capabilities.canRevealFile) {
      toolbarButtons.push(
        <Tooltip key="folder" title={t.viewer.revealInFolder}>
          <IconButton
            className="yarl__button"
            sx={toolbarButtonSx}
            onClick={() => platform.revealFile(currentImage.source)}
          >
            <FolderOpenOutlined />
          </IconButton>
        </Tooltip>,
      );
    }

    if (platform.capabilities.canDeleteFiles) {
      toolbarButtons.push(
        <Tooltip key="delete" title={t.viewer.deleteConfirm}>
          <IconButton
            className="yarl__button"
            sx={toolbarButtonSx}
            onClick={requestDelete}
          >
            <DeleteOutlined />
          </IconButton>
        </Tooltip>,
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
        zoom={{
          scrollToZoom: true,
        }}
        controller={{
          closeOnBackdropClick: true,
        }}
        toolbar={{
          buttons: toolbarButtons,
        }}
      />

      {/* Info popover */}
      <Popover
        open={Boolean(infoAnchor)}
        anchorEl={infoAnchor}
        onClose={() => setInfoAnchor(null)}
        disableRestoreFocus
        sx={{ pointerEvents: "none", zIndex: 10000 }}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
      >
        {currentImage && (
          <div style={{ padding: 12, maxWidth: 400, pointerEvents: "auto" }}>
            <Typography variant="body2">
              {t.viewer.fileName}: {getFileName(currentImage.source)}
            </Typography>
            {currentImage.width && currentImage.height && (
              <Typography variant="body2">
                {t.viewer.dimensions}: {currentImage.width} x{" "}
                {currentImage.height}
              </Typography>
            )}
            <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
              {t.viewer.filePath}: {currentImage.source}
            </Typography>
          </div>
        )}
      </Popover>

      {/* Delete confirmation dialog */}
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        sx={{ zIndex: 10000 }}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <DialogTitle>{t.viewer.deleteConfirm}</DialogTitle>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>
            {t.actions.close}
          </Button>
          <Button
            color="error"
            autoFocus
            onClick={() => {
              setConfirmOpen(false);
              executeDelete();
            }}
          >
            OK
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete success toast */}
      <Snackbar
        open={snackOpen}
        autoHideDuration={3000}
        onClose={() => setSnackOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        sx={{ zIndex: 10000 }}
      >
        <Alert
          severity="success"
          variant="filled"
          onClose={() => setSnackOpen(false)}
        >
          {t.viewer.deleteSuccess}
        </Alert>
      </Snackbar>
    </>
  );
}
