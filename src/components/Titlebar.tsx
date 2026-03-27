import CloseIcon from "@mui/icons-material/Close";
import CropSquareIcon from "@mui/icons-material/CropSquare";
import MinimizeIcon from "@mui/icons-material/Minimize";
import {
  AppBar,
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
} from "@mui/material";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useState } from "react";
import { useLocation } from "wouter";
import { useI18n } from "@/i18n";

const appWindow = getCurrentWindow();

export default function Titlebar() {
  const t = useI18n();
  const [, navigate] = useLocation();

  const [fileAnchor, setFileAnchor] = useState<null | HTMLElement>(null);
  const [windowAnchor, setWindowAnchor] = useState<null | HTMLElement>(null);
  const [helpAnchor, setHelpAnchor] = useState<null | HTMLElement>(null);

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
        <Button
          size="small"
          onClick={(e) => setFileAnchor(e.currentTarget)}
          sx={{ textTransform: "none", fontSize: 13, minWidth: "auto", px: 1 }}
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
              appWindow.close();
            }}
          >
            {t.menu.quit}
          </MenuItem>
        </Menu>

        <Button
          size="small"
          onClick={(e) => setWindowAnchor(e.currentTarget)}
          sx={{ textTransform: "none", fontSize: 13, minWidth: "auto", px: 1 }}
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
              appWindow.emit("tauri://devtools");
            }}
          >
            {t.menu.devTools}
          </MenuItem>
        </Menu>

        <Button
          size="small"
          onClick={(e) => setHelpAnchor(e.currentTarget)}
          sx={{ textTransform: "none", fontSize: 13, minWidth: "auto", px: 1 }}
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

        <IconButton
          size="small"
          onClick={() => appWindow.minimize()}
          sx={{ borderRadius: 0, width: 36, height: 36 }}
        >
          <MinimizeIcon sx={{ fontSize: 18 }} />
        </IconButton>
        <IconButton
          size="small"
          onClick={() => appWindow.toggleMaximize()}
          sx={{ borderRadius: 0, width: 36, height: 36 }}
        >
          <CropSquareIcon sx={{ fontSize: 16 }} />
        </IconButton>
        <IconButton
          size="small"
          onClick={() => appWindow.close()}
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
