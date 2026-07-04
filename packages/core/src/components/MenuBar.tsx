import {
  Database,
  Folder,
  Home,
  RefreshCw,
  Settings,
  SlidersHorizontal,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { usePlatform } from "@/context/PlatformContext";
import { useI18n } from "@/i18n";
import {
  incrementalRefresh,
  openFolderAndScan,
  resetToDropZone,
  startArchiveScan,
} from "@/lib/scanActions";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/appStore";

interface MenuBarProps {
  onQuit?: () => void;
  onDevTools?: () => void;
  trailing?: ReactNode;
  draggable?: boolean;
}

type MenuName = "file" | "window" | "help" | null;

export default function MenuBar({
  onQuit,
  onDevTools,
  trailing,
  draggable,
}: MenuBarProps) {
  const t = useI18n();
  const platform = usePlatform();
  const toggleQuickPanel = useAppStore((s) => s.toggleQuickPanel);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const [, navigate] = useLocation();
  const [openMenu, setOpenMenu] = useState<MenuName>(null);

  const itemClass =
    "block w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground";

  return (
    <header
      className="fixed left-0 right-0 top-0 z-50 flex h-9 items-center border-b border-border bg-popover/95 px-2 text-popover-foreground shadow-sm backdrop-blur"
      {...(draggable ? { "data-tauri-drag-region": true } : {})}
    >
      <img
        src="/logo/logo.svg"
        alt="MasonGallery"
        className="mr-1 size-5 shrink-0"
      />

      <div className="relative">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpenMenu(openMenu === "file" ? null : "file")}
        >
          {t.menu.file}
        </Button>
        {openMenu === "file" && (
          <div className="absolute left-0 top-8 z-50 min-w-44 overflow-hidden rounded-md border border-border bg-popover py-1 shadow-lg">
            <button
              type="button"
              className={itemClass}
              onClick={() => {
                setOpenMenu(null);
                openFolderAndScan();
              }}
            >
              {t.menu.openFolder}
            </button>
            {platform.capabilities.canBrowseArchives &&
              platform.pickArchive && (
                <button
                  type="button"
                  className={itemClass}
                  onClick={async () => {
                    setOpenMenu(null);
                    const path = await platform.pickArchive?.();
                    if (path) startArchiveScan(path);
                  }}
                >
                  {t.archive.openArchive}
                </button>
              )}
            <button
              type="button"
              className={itemClass}
              onClick={() => {
                setOpenMenu(null);
                resetToDropZone();
                navigate("/");
              }}
            >
              {t.menu.reset}
            </button>
            {onQuit && <div className="my-1 border-t border-border" />}
            {onQuit && (
              <button
                type="button"
                className={itemClass}
                onClick={() => {
                  setOpenMenu(null);
                  onQuit();
                }}
              >
                {t.menu.quit}
              </button>
            )}
          </div>
        )}
      </div>

      {onDevTools && (
        <div className="relative">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpenMenu(openMenu === "window" ? null : "window")}
          >
            {t.menu.window}
          </Button>
          {openMenu === "window" && (
            <div className="absolute left-0 top-8 z-50 min-w-36 overflow-hidden rounded-md border border-border bg-popover py-1 shadow-lg">
              <button
                type="button"
                className={itemClass}
                onClick={() => {
                  setOpenMenu(null);
                  onDevTools();
                }}
              >
                {t.menu.devTools}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="relative">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpenMenu(openMenu === "help" ? null : "help")}
        >
          {t.menu.help}
        </Button>
        {openMenu === "help" && (
          <div className="absolute left-0 top-8 z-50 min-w-36 overflow-hidden rounded-md border border-border bg-popover py-1 shadow-lg">
            <button
              type="button"
              className={itemClass}
              onClick={() => {
                setOpenMenu(null);
                navigate("/about");
              }}
            >
              {t.menu.about}
            </button>
          </div>
        )}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        title={t.actions.gallery}
        onClick={() => {
          setOpenMenu(null);
          navigate("/");
        }}
      >
        <Home />
      </Button>
      {platform.capabilities.canBrowseArchives && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title={t.actions.manage}
          onClick={() => {
            setOpenMenu(null);
            navigate("/manage/cache");
          }}
        >
          <Database />
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        title={t.actions.preferences}
        onClick={() => {
          setOpenMenu(null);
          navigate("/settings/appearance");
        }}
      >
        <SlidersHorizontal />
      </Button>

      <div
        className="min-w-4 flex-1"
        {...(draggable ? { "data-tauri-drag-region": true } : {})}
      />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        title={t.sidebar.folders}
        onClick={toggleSidebar}
      >
        <Folder />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        title={t.actions.refresh}
        onClick={() => incrementalRefresh()}
      >
        <RefreshCw />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        title={t.actions.quickControls}
        onClick={toggleQuickPanel}
      >
        <Settings />
      </Button>

      <div className={cn("ml-1 flex h-9 items-center")}>{trailing}</div>
    </header>
  );
}
