import {
  Button,
  ImageViewer,
  openFolderAndScan,
  Progress,
  resetToDropZone,
  startScan,
  useAppStore,
  useI18n,
  usePlatform,
  useViewerStore,
  WaterfallGrid,
} from "@mason-gallery/core";
import { FolderOpen, LockKeyhole, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { WebFolderRail } from "./WebFolderRail";

type PreviewImage = {
  src: string;
  width: number;
  height: number;
  alt: string;
  className: string;
};

const previewAssetUrl = (name: string) => `/r2/${name}`;

const previewColumns: Array<{
  id: string;
  direction: "up" | "down";
  duration: string;
  offset: string;
  images: PreviewImage[];
}> = [
  {
    id: "left",
    direction: "up",
    duration: "46s",
    offset: "pt-10",
    images: [
      {
        src: previewAssetUrl("interior.webp"),
        width: 480,
        height: 640,
        alt: "Soft interior detail",
        className: "h-[230px]",
      },
      {
        src: previewAssetUrl("lake.webp"),
        width: 640,
        height: 420,
        alt: "Misty lake shoreline",
        className: "h-[155px]",
      },
      {
        src: previewAssetUrl("flowers.webp"),
        width: 500,
        height: 500,
        alt: "Pale flowers close-up",
        className: "h-[190px]",
      },
      {
        src: previewAssetUrl("desk.webp"),
        width: 640,
        height: 430,
        alt: "Warm desk still life",
        className: "h-[165px]",
      },
    ],
  },
  {
    id: "middle-left",
    direction: "down",
    duration: "54s",
    offset: "pt-0",
    images: [
      {
        src: previewAssetUrl("stairwell.webp"),
        width: 420,
        height: 700,
        alt: "Architectural stairwell shadows",
        className: "h-[350px]",
      },
      {
        src: previewAssetUrl("glass.webp"),
        width: 480,
        height: 600,
        alt: "Glass prism light",
        className: "h-[220px]",
      },
      {
        src: previewAssetUrl("coast.webp"),
        width: 680,
        height: 420,
        alt: "Coastal grass and ocean",
        className: "h-[160px]",
      },
    ],
  },
  {
    id: "middle-right",
    direction: "up",
    duration: "50s",
    offset: "pt-14",
    images: [
      {
        src: previewAssetUrl("glass.webp"),
        width: 480,
        height: 600,
        alt: "Glass prism light repeated",
        className: "h-[235px]",
      },
      {
        src: previewAssetUrl("street.webp"),
        width: 480,
        height: 620,
        alt: "Quiet street texture",
        className: "h-[285px]",
      },
      {
        src: previewAssetUrl("interior.webp"),
        width: 480,
        height: 640,
        alt: "Soft interior detail repeated",
        className: "h-[185px]",
      },
    ],
  },
  {
    id: "right",
    direction: "down",
    duration: "58s",
    offset: "pt-6",
    images: [
      {
        src: previewAssetUrl("coast.webp"),
        width: 680,
        height: 420,
        alt: "Coastal grass and ocean repeated",
        className: "h-[165px]",
      },
      {
        src: previewAssetUrl("flowers.webp"),
        width: 500,
        height: 500,
        alt: "Pale flowers close-up repeated",
        className: "h-[205px]",
      },
      {
        src: previewAssetUrl("lake.webp"),
        width: 640,
        height: 420,
        alt: "Misty lake shoreline repeated",
        className: "h-[165px]",
      },
      {
        src: previewAssetUrl("street.webp"),
        width: 480,
        height: 620,
        alt: "Quiet street texture repeated",
        className: "h-[245px]",
      },
    ],
  },
];

function useLargePreview() {
  const query = "(min-width: 1024px)";
  const [matches, setMatches] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return matches;
}

function PreviewMasonry() {
  return (
    <div className="relative min-h-[720px] overflow-hidden">
      <style>{`
        @keyframes masonry-reel-up {
          from { transform: translateY(0); }
          to { transform: translateY(-50%); }
        }

        @keyframes masonry-reel-down {
          from { transform: translateY(-50%); }
          to { transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .masonry-reel-column {
            animation: none !important;
            transform: translateY(0) !important;
          }
        }
      `}</style>
      <div className="pointer-events-none absolute -inset-x-14 top-16 h-[28rem] rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-4 right-4 h-72 w-72 rounded-full bg-accent/50 blur-3xl" />
      <div
        className="relative h-[720px] overflow-hidden px-2"
        style={{
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)",
          maskImage:
            "linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)",
        }}
      >
        <div className="grid h-full grid-cols-4 gap-4 xl:gap-5">
          {previewColumns.map((column) => (
            <div
              key={column.id}
              className={`overflow-hidden ${column.offset}`}
              aria-hidden="true"
            >
              <div
                className="masonry-reel-column space-y-4 xl:space-y-5"
                style={{
                  animation: `${column.direction === "up" ? "masonry-reel-up" : "masonry-reel-down"} ${column.duration} linear infinite`,
                }}
              >
                {(["first", "second"] as const).flatMap((cycle) =>
                  column.images.map((image) => (
                    <img
                      key={`${column.id}-${cycle}-${image.alt}`}
                      src={image.src}
                      width={image.width}
                      height={image.height}
                      alt=""
                      className={`block w-full rounded-lg bg-card object-cover ring-1 ring-border/80 ${image.className}`}
                      loading="eager"
                    />
                  )),
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-background to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}

function WebEmptyGallery() {
  const t = useI18n();
  const platform = usePlatform();
  const showPreview = useLargePreview();

  useEffect(() => {
    const cleanup = platform.onDragDrop((paths) => {
      if (paths.length > 0) startScan(paths);
    });
    return cleanup;
  }, [platform]);

  return (
    <div className="relative h-full overflow-hidden bg-background text-foreground">
      <div
        className="pointer-events-none absolute inset-0 [background-size:28px_28px] [mask-image:linear-gradient(90deg,black,transparent_28%,transparent_72%,black)]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 0% 36%, color-mix(in oklch, var(--brand) 12%, transparent) 0 2px, transparent 3px)",
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-background to-transparent" />
      <section className="relative mx-auto grid h-full max-w-[1440px] grid-cols-1 items-center gap-14 px-6 py-10 sm:px-10 lg:grid-cols-[minmax(360px,0.78fr)_minmax(640px,1.22fr)] lg:px-16">
        <div className="max-w-[520px]">
          <h1 className="max-w-lg text-5xl font-semibold leading-[1.04] tracking-normal text-foreground md:text-[58px]">
            {t("home:webEmptyTitle")}
          </h1>
          <p className="mt-5 max-w-md text-xl leading-8 text-muted-foreground">
            {t("home:webEmptyHint")}
          </p>

          <div className="mt-8 max-w-[420px]">
            <Button
              type="button"
              variant="brand"
              className="h-14 w-full rounded-2xl px-6 text-lg shadow-lg shadow-brand/20"
              onClick={openFolderAndScan}
            >
              <FolderOpen className="size-6" data-icon="inline-start" />
              {t("home:webOpenFolder")}
            </Button>

            <div className="my-9 flex items-center gap-7 text-base font-medium text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              {t("home:webDropDivider")}
              <span className="h-px flex-1 bg-border" />
            </div>

            <div className="flex min-h-[176px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-brand/40 bg-card/70 px-8 text-center shadow-lg shadow-brand/10 backdrop-blur">
              <UploadCloud className="size-11 text-brand" strokeWidth={1.8} />
              <p className="mt-5 text-xl font-semibold text-foreground">
                {t("home:webDropTitle")}
              </p>
              <p className="mt-2 text-base leading-6 text-muted-foreground">
                {t("home:webDropHint")}
              </p>
            </div>

            <div className="mt-7 flex items-center justify-center gap-3 text-base text-muted-foreground">
              <LockKeyhole className="size-5 text-muted-foreground" />
              <span>{t("home:webPrivacy")}</span>
            </div>
          </div>
        </div>

        {showPreview && <PreviewMasonry />}
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
        <Progress
          aria-label={t("home:scanning")}
          value={totalCount > 0 ? progressValue : null}
          className="gap-0 [&_[data-slot=progress-track]]:h-1 [&_[data-slot=progress-track]]:rounded-none"
        />
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
              {t("home:webBackHome")}
            </button>
          </div>
          <div className="relative flex min-h-0 flex-1 overflow-hidden">
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
