import { Check, Lock } from "lucide-react";
import {
  type RenderComponentProps,
  useMasonry,
  usePositioner,
  useResizeObserver,
} from "masonic";
import type { RefCallback, RefObject } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { usePlatform } from "@/context/PlatformContext";
import { useThumbnailRequest } from "@/hooks/useThumbnailRequest";
import { useI18n } from "@/i18n";
import { getColumnCount } from "@/lib/columnBreakpoints";
import { requestArchiveUnlock } from "@/lib/scanActions";
import { selectableIdentitiesInRange } from "@/lib/selectionIdentity";
import { useEntryThumbnails } from "@/lib/thumbnailCache";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/appStore";
import { useSelectionStore } from "@/stores/selectionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useViewerStore } from "@/stores/viewerStore";
import type { WImage } from "@/types";

const GridSelectionContext = createContext<{
  onActivate: (index: number, shiftKey: boolean) => void;
} | null>(null);

function archivePathFromSource(source: string): string | null {
  if (!source.startsWith("archive:///")) return null;
  const withoutScheme = source.slice("archive:///".length);
  const hashIdx = withoutScheme.indexOf("#");
  return hashIdx === -1 ? withoutScheme : withoutScheme.slice(0, hashIdx);
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
  index,
  width: cellWidth,
}: RenderComponentProps<ImageCellData>) {
  const t = useI18n();
  const openViewer = useViewerStore((s) => s.openViewer);
  const platform = usePlatform();
  const folderThumbnails = useSettingsStore((s) => s.folderThumbnails);
  const modeEnabled = useSelectionStore((s) => s.modeEnabled);
  const selected = useSelectionStore((s) =>
    data.selectableFile ? s.entries.has(data.selectableFile.entryKey) : false,
  );
  const selection = useContext(GridSelectionContext);
  const liveThumbnails = useEntryThumbnails(data);
  const entry =
    liveThumbnails === data.thumbnails
      ? data
      : { ...data, thumbnails: liveThumbnails };
  const selectable = data.selectableFile != null;
  const selectMode = modeEnabled && selectable;
  const showSelected = selectMode && selected;

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
            void requestArchiveUnlock(archivePath);
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
      className={cn(
        "relative block w-full cursor-pointer overflow-hidden rounded-md bg-muted p-0 transition-shadow hover:shadow-lg",
        showSelected
          ? "ring-2 ring-brand ring-offset-1 ring-offset-background"
          : "border-0",
      )}
      onClick={(event) => {
        if (selectMode) {
          selection?.onActivate(index, event.shiftKey);
          return;
        }
        openViewer(data.globalIndex);
      }}
      aria-pressed={selectMode ? selected : undefined}
      aria-label={
        selectMode
          ? selected
            ? t("selection:selectedPressed")
            : t("selection:notSelectedPressed")
          : undefined
      }
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
      {showSelected && (
        <>
          <span className="pointer-events-none absolute inset-0 bg-brand/20" />
          <span className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-brand text-brand-foreground shadow">
            <Check className="size-3.5" />
          </span>
        </>
      )}
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
  const lastClickedIndexRef = useRef<number | null>(null);

  const onActivate = useCallback(
    (index: number, shiftKey: boolean) => {
      const image = images[index];
      if (!image?.selectableFile) return;
      const { toggle, selectMany } = useSelectionStore.getState();
      if (shiftKey && lastClickedIndexRef.current != null) {
        selectMany(
          selectableIdentitiesInRange(
            images,
            lastClickedIndexRef.current,
            index,
          ),
        );
      } else {
        toggle(image.selectableFile);
      }
      lastClickedIndexRef.current = index;
    },
    [images],
  );

  const { scrollTop, isScrolling } = useContainerScroll(scrollContainerRef);
  const { width, height } = useContainerSize(scrollContainerRef);

  useEffect(() => {
    useAppStore.getState().setGalleryLayoutWidth(width > 0 ? width : null);
  }, [width]);

  useEffect(() => {
    return () => {
      useAppStore.getState().setGalleryLayoutWidth(null);
    };
  }, []);

  const containerRef = useRef<HTMLElement>(null);
  const prevScanIdRef = useRef(scanId);
  const prevFolderRef = useRef(selectedFolder);
  const [, forceMeasurementRender] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scanId triggers restore
  useLayoutEffect(() => {
    if (scanId === prevScanIdRef.current) return;
    const savedScroll =
      isRelayout && scrollContainerRef.current
        ? scrollContainerRef.current.scrollTop
        : null;
    prevScanIdRef.current = scanId;
    if (savedScroll !== null && scrollContainerRef.current)
      scrollContainerRef.current.scrollTop = savedScroll;
  }, [scanId, scrollContainerRef]);

  useLayoutEffect(() => {
    if (selectedFolder === prevFolderRef.current) return;
    prevFolderRef.current = selectedFolder;
    if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
  }, [selectedFolder, scrollContainerRef]);

  const safeWidth = Math.max(width, 1);
  const columnCount = getColumnCount(safeWidth, breakpoints);
  const positioner = usePositioner(
    { width: safeWidth, columnCount, columnGutter: 8 },
    [scanId, columnCount, selectedFolder],
  );

  useEffect(() => {
    onPositionerReady?.(positioner, columnCount);
  }, [positioner, columnCount, onPositionerReady]);

  useLayoutEffect(() => {
    const measuredCount = positioner.size();
    let changed = false;
    if (width > 0 && measuredCount < images.length) {
      for (let i = measuredCount; i < images.length; i++) {
        const img = images[i] as WImage | undefined;
        if (img?.width && img.height && positioner.get(i) === undefined) {
          const displayHeight =
            positioner.columnWidth * (img.height / img.width);
          positioner.set(i, displayHeight);
          changed = true;
        }
      }
    }
    if (changed) forceMeasurementRender((revision) => revision + 1);
  }, [images, positioner, width]);

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

  return (
    <GridSelectionContext.Provider value={{ onActivate }}>
      <div className="p-2">{grid}</div>
    </GridSelectionContext.Provider>
  );
}
