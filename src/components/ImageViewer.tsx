import { useCallback } from "react";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { useViewerStore } from "@/stores/viewerStore";

export default function ImageViewer() {
  const images = useViewerStore((s) => s.images);
  const currentIndex = useViewerStore((s) => s.currentIndex);
  const isViewerOpen = useViewerStore((s) => s.isViewerOpen);
  const closeViewer = useViewerStore((s) => s.closeViewer);
  const setCurrentIndex = useViewerStore((s) => s.setCurrentIndex);
  const removeImage = useViewerStore((s) => s.removeImage);

  const slides = images.map((img) => ({
    src: convertFileSrc(img.source),
    width: img.width ?? undefined,
    height: img.height ?? undefined,
  }));

  const handleDeleteCurrent = useCallback(async () => {
    const img = images[currentIndex];
    if (!img) return;
    try {
      await invoke("delete_to_trash", { path: img.source });
      removeImage(currentIndex);
      if (images.length <= 1) {
        closeViewer();
      }
    } catch (e) {
      console.error("Failed to delete:", e);
    }
  }, [images, currentIndex, removeImage, closeViewer]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Delete") {
        handleDeleteCurrent();
      }
    },
    [handleDeleteCurrent],
  );

  if (!isViewerOpen) return null;

  return (
    <Lightbox
      open={isViewerOpen}
      close={closeViewer}
      slides={slides}
      index={currentIndex}
      on={{
        view: ({ index }) => setCurrentIndex(index),
      }}
      plugins={[Zoom]}
      zoom={{
        scrollToZoom: true,
      }}
      controller={{
        closeOnBackdropClick: true,
      }}
      render={{}}
    />
  );
}
