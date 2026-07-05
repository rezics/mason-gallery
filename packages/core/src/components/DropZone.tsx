import { Archive, FolderOpen, UploadCloud } from "lucide-react";
import { useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { usePlatform } from "@/context/PlatformContext";
import { useI18n } from "@/i18n";

const ARCHIVE_EXTENSIONS = [".zip", ".rar", ".7z", ".cbz", ".cbr"];

function isArchiveFile(path: string): boolean {
  const lower = path.toLowerCase();
  return ARCHIVE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

interface DropZoneProps {
  onFoldersSelected: (paths: string[]) => void;
  onArchiveSelected?: (path: string) => void;
}

export default function DropZone({
  onFoldersSelected,
  onArchiveSelected,
}: DropZoneProps) {
  const t = useI18n();
  const platform = usePlatform();

  useEffect(() => {
    const cleanup = platform.onDragDrop((paths) => {
      if (paths.length === 0) return;
      const archives = paths.filter(isArchiveFile);
      const folders = paths.filter((p) => !isArchiveFile(p));

      if (archives.length > 0 && archives[0] && onArchiveSelected) {
        onArchiveSelected(archives[0]);
      } else if (folders.length > 0) {
        onFoldersSelected(folders);
      } else if (paths.length > 0) {
        onFoldersSelected(paths);
      }
    });
    return cleanup;
  }, [platform, onFoldersSelected, onArchiveSelected]);

  const handleSelectFolder = useCallback(async () => {
    const paths = await platform.pickFolders();
    if (paths && paths.length > 0) onFoldersSelected(paths);
  }, [platform, onFoldersSelected]);

  const handleSelectArchive = useCallback(async () => {
    if (!platform.pickArchive || !onArchiveSelected) return;
    const path = await platform.pickArchive();
    if (path) onArchiveSelected(path);
  }, [platform, onArchiveSelected]);

  const canBrowseArchives =
    platform.capabilities.canBrowseArchives && onArchiveSelected;

  return (
    <section className="border-b border-border bg-background px-6 py-8">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-5 rounded-md border border-dashed border-border bg-muted/20 px-6 py-8 text-center">
        <div className="flex size-14 items-center justify-center rounded-md border border-border bg-background text-muted-foreground shadow-sm">
          <UploadCloud className="size-8" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {t("home:dropZoneTitle")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {canBrowseArchives
              ? t("archive:dropZoneHint")
              : t("home:dropZoneHint")}
          </p>
        </div>
        <div className="grid w-full max-w-md gap-3 sm:grid-cols-2">
          <Button type="button" onClick={handleSelectFolder}>
            <FolderOpen />
            {t("home:selectFolder")}
          </Button>
          {canBrowseArchives && (
            <Button
              type="button"
              variant="outline"
              onClick={handleSelectArchive}
            >
              <Archive />
              {t("archive:openArchive")}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
