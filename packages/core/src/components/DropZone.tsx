import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import { Box, Button, Stack, Typography } from "@mui/material";
import { useCallback, useEffect } from "react";
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

      // Separate archives from folders
      const archives = paths.filter(isArchiveFile);
      const folders = paths.filter((p) => !isArchiveFile(p));

      if (archives.length > 0 && archives[0] && onArchiveSelected) {
        // Open the first archive
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
    if (paths && paths.length > 0) {
      onFoldersSelected(paths);
    }
  }, [platform, onFoldersSelected]);

  const handleSelectArchive = useCallback(async () => {
    if (!platform.pickArchive || !onArchiveSelected) return;
    const path = await platform.pickArchive();
    if (path) {
      onArchiveSelected(path);
    }
  }, [platform, onArchiveSelected]);

  const canBrowseArchives =
    platform.capabilities.canBrowseArchives && onArchiveSelected;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        border: "2px dashed",
        borderColor: "divider",
        borderRadius: 2,
        m: 4,
        transition: "border-color 0.2s",
      }}
    >
      <CloudUploadIcon sx={{ fontSize: 64, color: "text.secondary", mb: 2 }} />
      <Typography variant="h5" color="text.secondary" gutterBottom>
        {t.home.dropZoneTitle}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {canBrowseArchives ? t.archive.dropZoneHint : t.home.dropZoneHint}
      </Typography>
      <Stack direction="row" spacing={1}>
        <Button
          variant="outlined"
          startIcon={<FolderOpenIcon />}
          onClick={handleSelectFolder}
        >
          {t.home.selectFolder}
        </Button>
        {canBrowseArchives && (
          <Button
            variant="outlined"
            startIcon={<Inventory2OutlinedIcon />}
            onClick={handleSelectArchive}
          >
            {t.archive.openArchive}
          </Button>
        )}
      </Stack>
    </Box>
  );
}
