import {
  type RenderComponentProps,
  useMasonry,
  usePositioner,
  useResizeObserver,
} from "masonic";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePlatform } from "@/context/PlatformContext";
import { useAppStore } from "@/stores/appStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useViewerStore } from "@/stores/viewerStore";
import type { ColumnBreakpoints, WImage } from "@/types";

function getColumnCount(width: number, breakpoints: ColumnBreakpoints): number {
  const keys = Object.keys(breakpoints)
    .map(Number)
    .sort((a, b) => b - a);
  const maxColumns = Math.max(...Object.values(breakpoints), 1);
  for (const key of keys) {
    if (width >= key) {
      return Math.min(breakpoints[key] ?? 1, maxColumns);
    }
  }
  return 1;
}

function useContainerScroll(ref: React.RefObject<HTMLElement | null>) {
  const [scrollTop, setScrollTop] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const rafRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        setScrollTop(el.scrollTop);
        setIsScrolling(true);
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setIsScrolling(false), 150);
        rafRef.current = 0;
      });
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafRef.current);
      clearTimeout(timeoutRef.current);
    };
  }, [ref]);

  return { scrollTop, isScrolling };
}

function useContainerSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return size;
}

interface ImageCellData extends WImage {
  globalIndex: number;
}

function ImageCell({ data }: RenderComponentProps<ImageCellData>) {
  const openViewer = useViewerStore((s) => s.openViewer);
  const platform = usePlatform();

  return (
    <button
      type="button"
      className="cursor-pointer overflow-hidden rounded-md bg-neutral-100 dark:bg-neutral-800 transition-shadow hover:shadow-lg w-full border-none p-0 block"
      onClick={() => openViewer(data.globalIndex)}
    >
      <img
        src={platform.getImageUrl(data.source)}
        alt=""
        loading="lazy"
        className="w-full block"
        style={{
          aspectRatio:
            data.width && data.height
              ? `${data.width} / ${data.height}`
              : undefined,
        }}
      />
    </button>
  );
}

interface WaterfallGridProps {
  scrollContainerRef: React.RefObject<HTMLElement | null>;
  images: ImageCellData[];
  onPositionerReady?: (
    positioner: ReturnType<typeof usePositioner>,
    columnCount: number,
  ) => void;
}

export default function WaterfallGrid({
  scrollContainerRef,
  images,
  onPositionerReady,
}: WaterfallGridProps) {
  const scanId = useViewerStore((s) => s.scanId);
  const isRelayout = useViewerStore((s) => s.isRelayout);
  const breakpoints = useSettingsStore((s) => s.breakpoints);
  const selectedFolder = useAppStore((s) => s.selectedFolder);

  const { scrollTop, isScrolling } = useContainerScroll(scrollContainerRef);
  const { width, height } = useContainerSize(scrollContainerRef);

  const containerRef = useRef<HTMLElement>(null);
  const savedScrollRef = useRef<number | null>(null);
  const prevScanIdRef = useRef(scanId);

  // Capture scroll position before positioner resets on relayout
  if (scanId !== prevScanIdRef.current) {
    if (isRelayout && scrollContainerRef.current) {
      savedScrollRef.current = scrollContainerRef.current.scrollTop;
    } else {
      savedScrollRef.current = null;
    }
    prevScanIdRef.current = scanId;
  }

  // Restore scroll position synchronously after DOM update.
  // scanId is intentionally in deps to trigger after positioner reset.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scanId triggers the restore
  useLayoutEffect(() => {
    if (savedScrollRef.current !== null && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = savedScrollRef.current;
      savedScrollRef.current = null;
    }
  }, [scanId, scrollContainerRef]);

  // Reset scroll to top when folder filter changes
  const prevFolderRef = useRef(selectedFolder);
  if (selectedFolder !== prevFolderRef.current) {
    prevFolderRef.current = selectedFolder;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }

  const safeWidth = Math.max(width, 1);
  const columnCount = getColumnCount(safeWidth, breakpoints);
  const positioner = usePositioner(
    { width: safeWidth, columnCount, columnGutter: 8 },
    [scanId, columnCount, selectedFolder],
  );

  // Notify parent when positioner changes
  useEffect(() => {
    onPositionerReady?.(positioner, columnCount);
  }, [positioner, columnCount, onPositionerReady]);

  // Pre-fill positioner with calculated heights from known dimensions.
  // This eliminates the "batch catch-up" freeze when scrolling to unmeasured regions,
  // because masonic's needsFreshBatch check sees measuredCount === itemCount.
  // Guard: skip when container hasn't been measured yet (width===0), otherwise
  // pre-fill runs with columnWidth≈1px producing tiny heights. When the real width
  // arrives, masonic's optsChanged branch copies those wrong heights into the new
  // positioner and the pre-fill loop is skipped (measuredCount===itemCount), causing
  // images to stack on top of each other.
  const measuredCount = positioner.size();
  if (width > 0 && measuredCount < images.length) {
    for (let i = measuredCount; i < images.length; i++) {
      const img = images[i] as WImage | undefined;
      if (img?.width && img.height && positioner.get(i) === undefined) {
        const displayHeight = positioner.columnWidth * (img.height / img.width);
        positioner.set(i, displayHeight);
      }
    }
  }

  const resizeObserver = useResizeObserver(positioner);

  const grid = useMasonry({
    positioner,
    resizeObserver,
    items: images,
    scrollTop,
    isScrolling,
    height,
    overscanBy: 5,
    render: ImageCell,
    containerRef,
  });

  if (images.length === 0 || width === 0) return <div className="p-2" />;

  return <div className="p-2">{grid}</div>;
}
