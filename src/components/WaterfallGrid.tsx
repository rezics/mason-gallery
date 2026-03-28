import { Masonry, type RenderComponentProps } from "masonic";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useSettingsStore } from "@/stores/settingsStore";
import { useViewerStore } from "@/stores/viewerStore";
import type { WImage } from "@/types";

function getColumnCount(
  width: number,
  breakpoints: Record<number, number>,
): number {
  const sorted = Object.entries(breakpoints)
    .map(([bp, cols]) => [Number(bp), cols] as [number, number])
    .sort((a, b) => a[0] - b[0]);

  for (const [bp, cols] of sorted) {
    if (width <= bp) return cols;
  }
  return sorted.at(-1)?.[1] ?? 4;
}

interface ImageCellProps {
  data: WImage;
  index: number;
}

function ImageCell({ data, index }: RenderComponentProps<WImage>) {
  const openViewer = useViewerStore((s) => s.openViewer);

  return (
    <button
      type="button"
      className="cursor-pointer overflow-hidden rounded-md bg-neutral-100 dark:bg-neutral-800 transition-shadow hover:shadow-lg w-full border-none p-0 block"
      onClick={() => openViewer(index)}
    >
      <img
        src={convertFileSrc(data.source)}
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

export default function WaterfallGrid() {
  const images = useViewerStore((s) => s.images);
  const breakpoints = useSettingsStore((s) => s.breakpoints);

  const columnGutter = 8;

  return (
    <div className="p-2">
      <Masonry
        items={images}
        columnGutter={columnGutter}
        columnWidth={200}
        overscanBy={5}
        render={ImageCell}
      />
    </div>
  );
}
