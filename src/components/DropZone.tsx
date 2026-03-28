import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import { Box, Button, Typography } from "@mui/material";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect } from "react";
import { useI18n } from "@/i18n";

interface DropZoneProps {
  onFoldersSelected: (paths: string[]) => void;
}

export default function DropZone({ onFoldersSelected }: DropZoneProps) {
  const t = useI18n();

  useEffect(() => {
    const unlisten = getCurrentWebviewWindow().onDragDropEvent((event) => {
      if (event.payload.type === "drop") {
        const paths = event.payload.paths;
        if (paths.length > 0) {
          onFoldersSelected(paths);
        }
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [onFoldersSelected]);

  const handleSelectFolder = useCallback(async () => {
    const selected = await open({ directory: true, multiple: true });
    if (selected) {
      const paths = Array.isArray(selected) ? selected : [selected];
      if (paths.length > 0) {
        onFoldersSelected(paths);
      }
    }
  }, [onFoldersSelected]);

  return (
    <Box
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
