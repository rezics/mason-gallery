import { useCallback, useEffect } from "react";
import Lightbox from "yet-another-react-lightbox";
import Counter from "yet-another-react-lightbox/plugins/counter";
import "yet-another-react-lightbox/plugins/counter.css";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import { usePlatform } from "@/context/PlatformContext";
import { useViewerStore } from "@/stores/viewerStore";

export default function ImageViewer() {
  const platform = usePlatform();
  const images = useViewerStore((s) => s.images);
  const currentIndex = useViewerStore((s) => s.currentIndex);
  const isViewerOpen = useViewerStore((s) => s.isViewerOpen);
  const closeViewer = useViewerStore((s) => s.closeViewer);
  const setCurrentIndex = useViewerStore((s) => s.setCurrentIndex);
  const removeImage = useViewerStore((s) => s.removeImage);

  const slides = images.map((img) => ({
    src: platform.getImageUrl(img.source),
    width: img.width ?? undefined,
    height: img.height ?? undefined,
  }));

  const handleDeleteCurrent = useCallback(async () => {
    if (!platform.capabilities.canDeleteFiles) return;
    const img = images[currentIndex];
    if (!img) return;
    try {
      await platform.deleteFile(img.source);
      removeImage(currentIndex);
      if (images.length <= 1) {
        closeViewer();
      }
    } catch (e) {
      console.error("Failed to delete:", e);
    }
  }, [platform, images, currentIndex, removeImage, closeViewer]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Delete" && platform.capabilities.canDeleteFiles) {
        handleDeleteCurrent();
      }
    },
    [platform.capabilities.canDeleteFiles, handleDeleteCurrent],
  );

  useEffect(() => {
    if (!isViewerOpen) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isViewerOpen, handleKeyDown]);

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
      plugins={[Counter, Zoom]}
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
