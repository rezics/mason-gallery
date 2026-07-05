import {
  Archive,
  Database,
  Folder,
  FolderOpen,
  Home,
  Info,
  MonitorCog,
  RefreshCw,
  RotateCcw,
  Settings,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
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
import { useViewerStore } from "@/stores/viewerStore";

interface MenuBarProps {
  onQuit?: () => void;
  onDevTools?: () => void;
  trailing?: ReactNode;
  draggable?: boolean;
}

type MenuName = "file" | "view" | "help" | null;

function MenuSeparator() {
  return <div className="my-1 border-t border-border/70" />;
}

function MenuShortcut({ children }: { children: ReactNode }) {
  return (
    <span className="ml-auto pl-6 text-xs text-muted-foreground">
      {children}
    </span>
  );
}

function MenuItem({
  icon,
  children,
  shortcut,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  children: ReactNode;
  shortcut?: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="flex h-8 w-full items-center gap-2 rounded-sm px-2.5 text-left text-sm text-popover-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground disabled:pointer-events-none disabled:opacity-45"
      onClick={onClick}
    >
      <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground [&_svg]:size-4">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {shortcut && <MenuShortcut>{shortcut}</MenuShortcut>}
    </button>
  );
}

function MenuPanel({ children }: { children: ReactNode }) {
  return (
    <div className="absolute left-0 top-8 z-50 min-w-56 origin-top-left overflow-hidden rounded-md border border-border bg-popover p-1.5 text-popover-foreground shadow-xl shadow-black/15 outline-none animate-menu-in">
      {children}
    </div>
  );
}

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
  const hasGallery = useViewerStore((s) => s.images.length > 0);
  const [, navigate] = useLocation();
  const [openMenu, setOpenMenu] = useState<MenuName>(null);
  const barRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!openMenu) return;

    const closeOnPointerDown = (event: PointerEvent) => {
      if (!barRef.current?.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenu(null);
      }
    };

    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openMenu]);

  const openArchive = async () => {
    const path = await platform.pickArchive?.();
    if (path) startArchiveScan(path);
  };

  return (
    <header
      ref={barRef}
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
          onPointerEnter={() => openMenu && setOpenMenu("file")}
        >
          {t.menu.file}
        </Button>
        {openMenu === "file" && (
          <MenuPanel>
            <MenuItem
              icon={<FolderOpen />}
              onClick={() => {
                setOpenMenu(null);
                openFolderAndScan();
              }}
            >
              {t.menu.openFolder}
            </MenuItem>
            {platform.capabilities.canBrowseArchives &&
              platform.pickArchive && (
                <MenuItem
                  icon={<Archive />}
                  onClick={async () => {
                    setOpenMenu(null);
                    await openArchive();
                  }}
                >
                  {t.archive.openArchive}
                </MenuItem>
              )}
            <MenuSeparator />
            <MenuItem
              icon={<RotateCcw />}
              onClick={() => {
                setOpenMenu(null);
                resetToDropZone();
                navigate("/");
              }}
            >
              {t.menu.reset}
            </MenuItem>
            {onQuit && (
              <>
                <MenuSeparator />
                <MenuItem
                  icon={<X />}
                  shortcut="Alt+F4"
                  onClick={() => {
                    setOpenMenu(null);
                    onQuit();
                  }}
                >
                  {t.menu.quit}
                </MenuItem>
              </>
            )}
          </MenuPanel>
        )}
      </div>

      <div className="relative">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpenMenu(openMenu === "view" ? null : "view")}
          onPointerEnter={() => openMenu && setOpenMenu("view")}
        >
          {t.menu.view}
        </Button>
        {openMenu === "view" && (
          <MenuPanel>
            <MenuItem
              icon={<Home />}
              onClick={() => {
                setOpenMenu(null);
                navigate("/");
              }}
            >
              {t.actions.gallery}
            </MenuItem>
            <MenuItem
              icon={<Folder />}
              disabled={!hasGallery}
              onClick={() => {
                if (!hasGallery) return;
                setOpenMenu(null);
                toggleSidebar();
              }}
            >
              {t.sidebar.folders}
            </MenuItem>
            <MenuItem
              icon={<Settings />}
              onClick={() => {
                setOpenMenu(null);
                toggleQuickPanel();
              }}
            >
              {t.actions.quickControls}
            </MenuItem>
            <MenuItem
              icon={<RefreshCw />}
              onClick={() => {
                setOpenMenu(null);
                incrementalRefresh();
              }}
            >
              {t.actions.refresh}
            </MenuItem>
            {platform.capabilities.canBrowseArchives && (
              <MenuItem
                icon={<Database />}
                onClick={() => {
                  setOpenMenu(null);
                  navigate("/manage/cache");
                }}
              >
                {t.archive.manageCache}
              </MenuItem>
            )}
            <MenuSeparator />
            <MenuItem
              icon={<SlidersHorizontal />}
              onClick={() => {
                setOpenMenu(null);
                navigate("/settings/appearance");
              }}
            >
              {t.actions.preferences}
            </MenuItem>
            {onDevTools && (
              <>
                <MenuSeparator />
                <MenuItem
                  icon={<MonitorCog />}
                  onClick={() => {
                    setOpenMenu(null);
                    onDevTools();
                  }}
                >
                  {t.menu.devTools}
                </MenuItem>
              </>
            )}
          </MenuPanel>
        )}
      </div>

      <div className="relative">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpenMenu(openMenu === "help" ? null : "help")}
          onPointerEnter={() => openMenu && setOpenMenu("help")}
        >
          {t.menu.help}
        </Button>
        {openMenu === "help" && (
          <MenuPanel>
            <MenuItem
              icon={<Info />}
              onClick={() => {
                setOpenMenu(null);
                navigate("/about");
              }}
            >
              {t.menu.about}
            </MenuItem>
          </MenuPanel>
        )}
      </div>

      <div
        className="min-w-4 flex-1"
        {...(draggable ? { "data-tauri-drag-region": true } : {})}
      />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        title={t.sidebar.folders}
        disabled={!hasGallery}
        onClick={() => {
          if (hasGallery) toggleSidebar();
        }}
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
