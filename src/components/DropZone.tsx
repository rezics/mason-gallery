import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import { Box, Button, Typography } from "@mui/material";
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback } from "react";
import { useI18n } from "@/i18n";

interface DropZoneProps {
  onFoldersSelected: (paths: string[]) => void;
}

export default function DropZone({ onFoldersSelected }: DropZoneProps) {
  const t = useI18n();

  const handleSelectFolder = useCallback(async () => {
    const selected = await open({ directory: true, multiple: true });
    if (selected) {
      const paths = Array.isArray(selected) ? selected : [selected];
      if (paths.length > 0) {
        onFoldersSelected(paths);
      }
    }
  }, [onFoldersSelected]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const paths: string[] = [];
      for (const item of Array.from(e.dataTransfer.items)) {
        const entry = item.webkitGetAsEntry?.();
        if (entry?.isDirectory) {
          paths.push(entry.fullPath);
        }
      }
      if (paths.length > 0) {
        onFoldersSelected(paths);
      }
    },
    [onFoldersSelected],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return (
    <Box
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={handleSelectFolder}
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
        cursor: "pointer",
        transition: "border-color 0.2s",
        "&:hover": {
          borderColor: "primary.main",
        },
      }}
    >
      <CloudUploadIcon sx={{ fontSize: 64, color: "text.secondary", mb: 2 }} />
      <Typography variant="h5" color="text.secondary" gutterBottom>
        {t.home.dropZoneTitle}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t.home.dropZoneHint}
      </Typography>
      <Button variant="outlined" startIcon={<CloudUploadIcon />}>
        {t.home.selectFolder}
      </Button>
    </Box>
  );
}
