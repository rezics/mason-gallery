import { Lock } from "lucide-react";
import {
  type RenderComponentProps,
  useMasonry,
  usePositioner,
  useResizeObserver,
} from "masonic";
import type { RefCallback, RefObject } from "react";
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
    if (width >= key) return Math.min(breakpoints[key] ?? 1, maxColumns);
  }
  return 1;
}

function useContainerScroll(ref: RefObject<HTMLElement | null>) {
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

function useContainerSize(ref: RefObject<HTMLElement | null>) {
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
        ref={tileRef as RefCallback<HTMLButtonElement>}
        type="button"
        className="flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-md border border-border bg-muted p-3 transition-shadow hover:shadow-lg"
        onClick={() => {
          if (archivePath) {
            useAppStore.setState({ archivePasswordNeeded: archivePath });
          }
        }}
      >
        <Lock className="size-8" />
        <span className="line-clamp-2 break-all text-center text-xs">
          {archiveName}
        </span>
      </button>
    );
  }

  const thumbs = entry.thumbnails ?? [];
  const srcSet =
    thumbs.length > 0
      ? thumbs
          .map((t) => {
            const url = platform.getThumbUrl(t.source);
            return url ? `${url} ${t.width}w` : "";
          })
          .filter(Boolean)
          .join(", ")
      : undefined;
  const sizes = cellWidth > 0 ? `${Math.round(cellWidth)}px` : undefined;
  const firstThumb = thumbs[0];
  const fallback = firstThumb
    ? platform.getThumbUrl(firstThumb.source)
    : platform.getImageUrl(entry.source);

  return (
    <button
      ref={tileRef as RefCallback<HTMLButtonElement>}
      type="button"
      className="block w-full cursor-pointer overflow-hidden rounded-md border-0 bg-muted p-0 transition-shadow hover:shadow-lg"
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
        className="block w-full"
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
  scrollContainerRef: RefObject<HTMLElement | null>;
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

  if (scanId !== prevScanIdRef.current) {
    if (isRelayout && scrollContainerRef.current) {
      savedScrollRef.current = scrollContainerRef.current.scrollTop;
    } else {
      savedScrollRef.current = null;
    }
    prevScanIdRef.current = scanId;
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: scanId triggers restore
  useLayoutEffect(() => {
    if (savedScrollRef.current !== null && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = savedScrollRef.current;
      savedScrollRef.current = null;
    }
  }, [scanId, scrollContainerRef]);

  const prevFolderRef = useRef(selectedFolder);
  if (selectedFolder !== prevFolderRef.current) {
    prevFolderRef.current = selectedFolder;
    if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
  }

  const safeWidth = Math.max(width, 1);
  const columnCount = getColumnCount(safeWidth, breakpoints);
  const positioner = usePositioner(
    { width: safeWidth, columnCount, columnGutter: 8 },
    [scanId, columnCount, selectedFolder],
  );

  useEffect(() => {
    onPositionerReady?.(positioner, columnCount);
  }, [positioner, columnCount, onPositionerReady]);

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
