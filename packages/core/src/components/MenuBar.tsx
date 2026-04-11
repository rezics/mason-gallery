import FolderIcon from "@mui/icons-material/Folder";
import RefreshIcon from "@mui/icons-material/Refresh";
import SettingsIcon from "@mui/icons-material/Settings";
import {
  AppBar,
  Box,
  Button,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
} from "@mui/material";
import type { ReactNode } from "react";
import { useState } from "react";
import { useLocation } from "wouter";
import { usePlatform } from "@/context/PlatformContext";
import { useI18n } from "@/i18n";
import {
  incrementalRefresh,
  openFolderAndScan,
  resetToDropZone,
  startArchiveScan,
} from "@/lib/scanActions";
import { useAppStore } from "@/stores/appStore";

interface MenuBarProps {
  onQuit?: () => void;
  onDevTools?: () => void;
  trailing?: ReactNode;
  draggable?: boolean;
}

export default function MenuBar({
  onQuit,
  onDevTools,
  trailing,
  draggable,
}: MenuBarProps) {
  const t = useI18n();
  const platform = usePlatform();
  const toggleSettings = useAppStore((s) => s.toggleSettings);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const [, navigate] = useLocation();

  const [fileAnchor, setFileAnchor] = useState<null | HTMLElement>(null);
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
        sx={{ minHeight: 36, px: 1, gap: 0 }}
        {...(draggable ? { "data-tauri-drag-region": true } : {})}
      >
        {/* App Logo */}
        <Box
          component="img"
          src="/logo/logo.svg"
          alt="MasonGallery"
          sx={{ width: 20, height: 20, mr: 0.5, flexShrink: 0 }}
        />

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
          {platform.capabilities.canBrowseArchives &&
            platform.pickArchive && (
              <MenuItem
                onClick={async () => {
                  setFileAnchor(null);
                  if (platform.pickArchive) {
                    const path = await platform.pickArchive();
                    if (path) startArchiveScan(path);
                  }
                }}
              >
                {t.archive.openArchive}
              </MenuItem>
            )}
          <MenuItem
            onClick={() => {
              setFileAnchor(null);
              resetToDropZone();
              navigate("/");
            }}
          >
            {t.menu.reset}
          </MenuItem>
          {onQuit && <Divider />}
          {onQuit && (
            <MenuItem
              onClick={() => {
                setFileAnchor(null);
                onQuit();
              }}
            >
              {t.menu.quit}
            </MenuItem>
          )}
        </Menu>

        {/* Window Menu (desktop only) */}
        {onDevTools && (
          <>
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
                  onDevTools();
                }}
              >
                {t.menu.devTools}
              </MenuItem>
            </Menu>
          </>
        )}

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

        <Box
          sx={{ flex: 1 }}
          {...(draggable ? { "data-tauri-drag-region": true } : {})}
        />

        {/* Top-level action buttons */}
        <Tooltip title={t.sidebar.folders}>
          <IconButton size="small" onClick={toggleSidebar} sx={{ mx: 0.25 }}>
            <FolderIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title={t.actions.refresh}>
          <IconButton
            size="small"
            onClick={() => incrementalRefresh()}
            sx={{ mx: 0.25 }}
          >
            <RefreshIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title={t.actions.settings}>
          <IconButton size="small" onClick={toggleSettings} sx={{ mx: 0.25 }}>
            <SettingsIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>

        {trailing}
      </Toolbar>
    </AppBar>
  );
}
