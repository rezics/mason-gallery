import {
  useMasonry,
  usePositioner,
  useResizeObserver,
  type RenderComponentProps,
} from "masonic";
import { useEffect, useRef, useState } from "react";
import { usePlatform } from "@/context/PlatformContext";
import { useViewerStore } from "@/stores/viewerStore";
import type { WImage } from "@/types";

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

function ImageCell({ data, index }: RenderComponentProps<WImage>) {
  const openViewer = useViewerStore((s) => s.openViewer);
  const platform = usePlatform();

  return (
    <button
      type="button"
      className="cursor-pointer overflow-hidden rounded-md bg-neutral-100 dark:bg-neutral-800 transition-shadow hover:shadow-lg w-full border-none p-0 block"
      onClick={() => openViewer(index)}
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
}

export default function WaterfallGrid({
  scrollContainerRef,
}: WaterfallGridProps) {
  const images = useViewerStore((s) => s.images);
  const scanId = useViewerStore((s) => s.scanId);

  const { scrollTop, isScrolling } = useContainerScroll(scrollContainerRef);
  const { width, height } = useContainerSize(scrollContainerRef);

  const containerRef = useRef<HTMLElement>(null);

  const safeWidth = Math.max(width, 1);
  const positioner = usePositioner(
    { width: safeWidth, columnWidth: 200, columnGutter: 8 },
    [scanId],
  );
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
