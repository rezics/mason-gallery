import { MenuBar } from "@mason-gallery/core";
import CloseIcon from "@mui/icons-material/Close";
import CropSquareIcon from "@mui/icons-material/CropSquare";
import MinimizeIcon from "@mui/icons-material/Minimize";
import { IconButton } from "@mui/material";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useRef } from "react";

function useAppWindow() {
  const ref = useRef<ReturnType<typeof getCurrentWindow> | null>(null);
  if (!ref.current) {
    ref.current = getCurrentWindow();
  }
  return ref.current;
}

function WindowControls() {
  const appWindow = useAppWindow();

  return (
    <>
      <IconButton
        size="small"
        onClick={() => appWindow.minimize().catch(console.error)}
        sx={{ borderRadius: 0, width: 36, height: 36 }}
      >
        <MinimizeIcon sx={{ fontSize: 18 }} />
      </IconButton>
      <IconButton
        size="small"
        onClick={() => appWindow.toggleMaximize().catch(console.error)}
        sx={{ borderRadius: 0, width: 36, height: 36 }}
      >
        <CropSquareIcon sx={{ fontSize: 16 }} />
      </IconButton>
      <IconButton
        size="small"
        onClick={() => appWindow.close().catch(console.error)}
        sx={{
          borderRadius: 0,
          width: 36,
          height: 36,
          "&:hover": { bgcolor: "error.main", color: "white" },
        }}
      >
        <CloseIcon sx={{ fontSize: 18 }} />
      </IconButton>
    </>
  );
}

export default function Titlebar() {
  const appWindow = useAppWindow();

  return (
    <MenuBar
      draggable
      onQuit={() => appWindow.close().catch(console.error)}
      onDevTools={() => invoke("open_devtools").catch(console.error)}
      trailing={<WindowControls />}
    />
  );
}
