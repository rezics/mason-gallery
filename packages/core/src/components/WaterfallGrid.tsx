import LockIcon from "@mui/icons-material/Lock";
import {
  type RenderComponentProps,
  useMasonry,
  usePositioner,
  useResizeObserver,
} from "masonic";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePlatform } from "@/context/PlatformContext";
import { useThumbnailRequest } from "@/hooks/useThumbnailRequest";
import { useAppStore } from "@/stores/appStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useViewerStore } from "@/stores/viewerStore";
import type { ColumnBreakpoints, WImage } from "@/types";

function archivePathFromSource(source: string): string | null {
  if (!source.startsWith("archive:///")) return null;
  const withoutScheme = source.slice("archive:///".length);
  const hashIdx = withoutScheme.indexOf("#");
  return hashIdx === -1 ? withoutScheme : withoutScheme.slice(0, hashIdx);
}

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

function ImageCell({
  data,
  width: cellWidth,
}: RenderComponentProps<ImageCellData>) {
  const openViewer = useViewerStore((s) => s.openViewer);
  const platform = usePlatform();
  const folderThumbnails = useSettingsStore((s) => s.folderThumbnails);

  // Subscribe to this specific entry so patchThumbnails triggers a re-render
  // without re-rendering sibling tiles.
  const entry = useViewerStore((s) => s.images[data.globalIndex]) ?? data;

  const hookEnabled =
    folderThumbnails === "lazy" &&
    !entry.locked &&
    entry.sourceId !== undefined &&
    !(entry.thumbnails && entry.thumbnails.length > 0);

  const tileRef = useThumbnailRequest(entry, hookEnabled);

  if (entry.locked) {
    const archivePath = archivePathFromSource(entry.source);
    const archiveName = archivePath
      ? archivePath.split(/[\\/]/).pop() || archivePath
      : entry.relativePath;
    return (
      <button
        ref={tileRef as React.RefCallback<HTMLButtonElement>}
        type="button"
        className="cursor-pointer overflow-hidden rounded-md bg-neutral-100 dark:bg-neutral-800 transition-shadow hover:shadow-lg w-full border-none p-3 flex flex-col items-center justify-center gap-2 aspect-square"
        onClick={() => {
          if (archivePath) {
            useAppStore.setState({ archivePasswordNeeded: archivePath });
          }
        }}
      >
        <LockIcon fontSize="large" />
        <span className="text-xs text-center break-all line-clamp-2">
          {archiveName}
        </span>
      </button>
    );
  }

  const thumbs = entry.thumbnails ?? [];
  const hasThumbs = thumbs.length > 0;

  const srcSet = hasThumbs
    ? thumbs
        .map((t) => {
          const url = platform.getThumbUrl(t.source);
          return url ? `${url} ${t.width}w` : "";
        })
        .filter(Boolean)
        .join(", ")
    : undefined;

  // `sizes` reflects the rendered column width so the browser picks the right srcset candidate.
  const sizes = cellWidth > 0 ? `${Math.round(cellWidth)}px` : undefined;

  // Fallback src: smallest thumbnail if we have them, otherwise the original.
  const firstThumb = thumbs[0];
  const fallback = firstThumb
    ? platform.getThumbUrl(firstThumb.source)
    : platform.getImageUrl(entry.source);

  return (
    <button
      ref={tileRef as React.RefCallback<HTMLButtonElement>}
      type="button"
      className="cursor-pointer overflow-hidden rounded-md bg-neutral-100 dark:bg-neutral-800 transition-shadow hover:shadow-lg w-full border-none p-0 block"
      onClick={() => openViewer(data.globalIndex)}
    >
      <img
        src={fallback || platform.getImageUrl(entry.source)}
        srcSet={srcSet}
        sizes={sizes}
        alt=""
        loading="lazy"
        width={entry.width ?? undefined}
        height={entry.height ?? undefined}
        className="w-full block"
        style={{
          aspectRatio:
            entry.width && entry.height
              ? `${entry.width} / ${entry.height}`
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
