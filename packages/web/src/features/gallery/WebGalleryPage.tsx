import {
  ImageViewer,
  openFolderAndScan,
  resetToDropZone,
  startScan,
  useAppStore,
  useI18n,
  usePlatform,
  useViewerStore,
  WaterfallGrid,
} from "@mason-gallery/core";
import { FolderOpen, ImagePlus, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { WebFolderRail } from "./WebFolderRail";

const previewImages = [
  {
    src: "/local-preview/masonry/interior.webp",
    width: 480,
    height: 640,
    alt: "Soft interior detail",
  },
  {
    src: "/local-preview/masonry/lake.webp",
    width: 640,
    height: 420,
    alt: "Misty lake shoreline",
  },
  {
    src: "/local-preview/masonry/flowers.webp",
    width: 500,
    height: 500,
    alt: "Pale flowers close-up",
  },
  {
    src: "/local-preview/masonry/stairwell.webp",
    width: 420,
    height: 700,
    alt: "Architectural stairwell shadows",
  },
  {
    src: "/local-preview/masonry/desk.webp",
    width: 640,
    height: 430,
    alt: "Warm desk still life",
  },
  {
    src: "/local-preview/masonry/glass.webp",
    width: 480,
    height: 600,
    alt: "Glass prism light",
  },
  {
    src: "/local-preview/masonry/street.webp",
    width: 480,
    height: 620,
    alt: "Quiet street texture",
  },
  {
    src: "/local-preview/masonry/coast.webp",
    width: 680,
    height: 420,
    alt: "Coastal grass and ocean",
  },
];

function PreviewMasonry() {
  return (
    <div className="relative hidden min-h-[500px] lg:block">
      <div className="absolute -inset-8 rounded-[2rem] bg-gradient-to-br from-primary/10 via-transparent to-secondary/70 blur-3xl" />
      <div className="relative h-[560px] overflow-hidden rounded-lg border border-border bg-card/85 p-4 shadow-2xl shadow-foreground/10 backdrop-blur-xl">
        <div className="columns-3 gap-3 [column-fill:_balance]">
          {previewImages.map((image) => (
            <img
              key={image.src}
              src={image.src}
              width={image.width}
              height={image.height}
              alt={image.alt}
              className="mb-3 block w-full break-inside-avoid rounded-md bg-muted object-cover shadow-sm ring-1 ring-black/5"
              loading="eager"
              style={{ aspectRatio: `${image.width} / ${image.height}` }}
            />
          ))}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-card via-card/85 to-transparent" />
      </div>
    </div>
  );
}

function WebEmptyGallery() {
  const platform = usePlatform();

  useEffect(() => {
    const cleanup = platform.onDragDrop((paths) => {
      if (paths.length > 0) startScan(paths);
    });
    return cleanup;
  }, [platform]);

  return (
    <div className="relative h-full overflow-hidden bg-[radial-gradient(circle_at_18%_16%,hsl(var(--accent))_0%,transparent_32%),linear-gradient(135deg,hsl(var(--background))_0%,hsl(var(--background))_46%,hsl(var(--muted))_100%)]">
      <section className="mx-auto grid h-full max-w-7xl grid-cols-1 items-center gap-10 px-6 py-10 lg:grid-cols-[minmax(0,0.86fr)_minmax(420px,1.14fr)]">
        <div className="max-w-xl">
          <div className="mb-8 inline-flex size-14 items-center justify-center rounded-md border border-border bg-card text-primary shadow-sm">
            <ImagePlus className="size-7" />
          </div>
          <h1 className="max-w-lg text-5xl font-semibold leading-[1.02] tracking-normal text-foreground md:text-6xl">
            Open a folder. Start browsing.
          </h1>
          <p className="mt-5 max-w-md text-base leading-7 text-muted-foreground">
            Mason Gallery stays local in your browser: pick a folder or drop one
            onto the window to build a clean masonry view.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="inline-flex h-12 items-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90"
              onClick={openFolderAndScan}
            >
              <FolderOpen className="size-4" />
              Open folder
            </button>
            <div className="inline-flex h-12 items-center gap-2 rounded-md border border-dashed border-border bg-card/70 px-4 text-sm font-medium text-muted-foreground shadow-sm backdrop-blur">
              <UploadCloud className="size-4" />
              Drop a folder anywhere
            </div>
          </div>

          <div className="mt-8 max-w-sm rounded-md border border-dashed border-border bg-card/60 p-4 text-sm text-muted-foreground shadow-sm backdrop-blur">
            Your files stay on your device. Nothing is uploaded.
          </div>
        </div>

        <PreviewMasonry />
      </section>
    </div>
  );
}

export function WebGalleryPage() {
  const t = useI18n();
  const allImages = useViewerStore((s) => s.images);
  const isScanning = useViewerStore((s) => s.isScanning);
  const totalCount = useViewerStore((s) => s.totalCount);
  const selectedFolder = useAppStore((s) => s.selectedFolder);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const images = useMemo(() => {
    const withIndex = allImages.map((img, i) => ({ ...img, globalIndex: i }));
    if (!selectedFolder) return withIndex;
    const prefix = `${selectedFolder}/`;
    return withIndex.filter((img) => img.relativePath.startsWith(prefix));
  }, [allImages, selectedFolder]);

  const showEmptyGallery = allImages.length === 0 && !isScanning;
  const progressValue =
    isScanning && totalCount > 0 ? (allImages.length / totalCount) * 100 : 35;

  return (
    <div className="flex h-full flex-col bg-background">
      {isScanning && (
        <div className="h-1 overflow-hidden bg-secondary">
          <div
            className={`h-full bg-primary ${totalCount > 0 ? "" : "animate-pulse"}`}
            style={{ width: `${progressValue}%` }}
          />
        </div>
      )}

      {showEmptyGallery ? (
        <WebEmptyGallery />
      ) : (
        <>
          <div className="flex items-center justify-between border-b border-border bg-background/85 px-6 py-3 text-sm backdrop-blur">
            <span className="font-medium text-foreground">
              {isScanning
                ? totalCount > 0
                  ? t("home:scanProgress", {
                      loaded: allImages.length,
                      total: totalCount,
                    })
                  : t("home:scanning")
                : t("home:imageCount", { count: images.length })}
            </span>
            <button
              type="button"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
              onClick={resetToDropZone}
            >
              Back home
            </button>
          </div>
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <WebFolderRail />
            <div
              ref={scrollContainerRef}
              className="min-w-0 flex-1 overflow-auto bg-background"
            >
              <WaterfallGrid
                scrollContainerRef={scrollContainerRef}
                images={images}
              />
            </div>
          </div>
        </>
      )}

      <ImageViewer />
    </div>
  );
}
