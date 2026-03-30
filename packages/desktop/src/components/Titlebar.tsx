import {
  openFolderAndScan,
  refresh,
  resetToDropZone,
  useI18n,
} from "@mason-gallery/core";
import CloseIcon from "@mui/icons-material/Close";
import CropSquareIcon from "@mui/icons-material/CropSquare";
import MinimizeIcon from "@mui/icons-material/Minimize";
import {
  AppBar,
  Box,
  Button,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
} from "@mui/material";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useRef, useState } from "react";
import { useLocation } from "wouter";

function useAppWindow() {
  const ref = useRef<ReturnType<typeof getCurrentWindow> | null>(null);
  if (!ref.current) {
    ref.current = getCurrentWindow();
  }
  return ref.current;
}

export default function Titlebar() {
  const appWindow = useAppWindow();
  const t = useI18n();
  const [, navigate] = useLocation();

  const [fileAnchor, setFileAnchor] = useState<null | HTMLElement>(null);
  const [viewAnchor, setViewAnchor] = useState<null | HTMLElement>(null);
  const [windowAnchor, setWindowAnchor] = useState<null | HTMLElement>(null);
  const [helpAnchor, setHelpAnchor] = useState<null | HTMLElement>(null);

  const menuButtonSx = {
    textTransform: "none",
    fontSize: 13,
    minWidth: "auto",
    px: 1,
  } as const;

  return (
    <AppBar
      position="fixed"
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        height: 36,
        bgcolor: "background.paper",
        color: "text.primary",
        boxShadow: 1,
      }}
    >
      <Toolbar
        variant="dense"
        data-tauri-drag-region
        sx={{ minHeight: 36, px: 1, gap: 0 }}
      >
        {/* File Menu */}
        <Button
          size="small"
          onClick={(e) => setFileAnchor(e.currentTarget)}
          sx={menuButtonSx}
        >
          {t.menu.file}
        </Button>
        <Menu
          anchorEl={fileAnchor}
          open={!!fileAnchor}
          onClose={() => setFileAnchor(null)}
        >
          <MenuItem
            onClick={() => {
              setFileAnchor(null);
              openFolderAndScan();
            }}
          >
            {t.menu.openFolder}
          </MenuItem>
          <MenuItem
            onClick={() => {
              setFileAnchor(null);
              resetToDropZone();
              navigate("/");
            }}
          >
            {t.menu.reset}
          </MenuItem>
          <Divider />
          <MenuItem
            onClick={() => {
              setFileAnchor(null);
              appWindow.close().catch(console.error);
            }}
          >
            {t.menu.quit}
          </MenuItem>
        </Menu>

        {/* View Menu */}
        <Button
          size="small"
          onClick={(e) => setViewAnchor(e.currentTarget)}
          sx={menuButtonSx}
        >
          {t.menu.view}
        </Button>
        <Menu
          anchorEl={viewAnchor}
          open={!!viewAnchor}
          onClose={() => setViewAnchor(null)}
        >
          <MenuItem
            onClick={() => {
              setViewAnchor(null);
              refresh();
            }}
          >
            {t.menu.refresh}
          </MenuItem>
        </Menu>

        {/* Window Menu */}
        <Button
          size="small"
          onClick={(e) => setWindowAnchor(e.currentTarget)}
          sx={menuButtonSx}
        >
          {t.menu.window}
        </Button>
        <Menu
          anchorEl={windowAnchor}
          open={!!windowAnchor}
          onClose={() => setWindowAnchor(null)}
        >
          <MenuItem
            onClick={() => {
              setWindowAnchor(null);
              appWindow.emit("tauri://devtools").catch(console.error);
            }}
          >
            {t.menu.devTools}
          </MenuItem>
        </Menu>

        {/* Help Menu */}
        <Button
          size="small"
          onClick={(e) => setHelpAnchor(e.currentTarget)}
          sx={menuButtonSx}
        >
          {t.menu.help}
        </Button>
        <Menu
          anchorEl={helpAnchor}
          open={!!helpAnchor}
          onClose={() => setHelpAnchor(null)}
        >
          <MenuItem
            onClick={() => {
              setHelpAnchor(null);
              navigate("/about");
            }}
          >
            {t.menu.about}
          </MenuItem>
        </Menu>

        <Box sx={{ flex: 1 }} data-tauri-drag-region />

        {/* Window Controls */}
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
      </Toolbar>
    </AppBar>
  );
}
