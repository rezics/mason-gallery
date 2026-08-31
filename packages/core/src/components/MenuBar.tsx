import {
  Archive,
  Database,
  Folder,
  FolderOpen,
  Home,
  Info,
  MessageSquare,
  MonitorCog,
  RefreshCw,
  RotateCcw,
  Settings,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePlatform } from "@/context/PlatformContext";
import { useI18n } from "@/i18n";
import { GITHUB_ISSUES_URL } from "@/lib/projectLinks";
import {
  incrementalRefresh,
  openFolderAndScan,
  resetToDropZone,
  startArchiveScan,
} from "@/lib/scanActions";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/appStore";
import { useUpdateStore } from "@/stores/updateStore";
import { useViewerStore } from "@/stores/viewerStore";
import { isUpdateBusy } from "@/updates/updateController";

interface MenuBarProps {
  onQuit?: () => void;
  onDevTools?: () => void;
  trailing?: ReactNode;
  draggable?: boolean;
}

function MenuButton({ children }: { children: ReactNode }) {
  return (
    <DropdownMenuTrigger
      render={<Button type="button" variant="ghost" size="sm" />}
    >
      {children}
    </DropdownMenuTrigger>
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
  const toggleQuickPanel = useAppStore((state) => state.toggleQuickPanel);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const hasGallery = useViewerStore((state) => state.images.length > 0);
  const [, navigate] = useLocation();
  const canAutoUpdate = platform.capabilities.canAutoUpdate;
  const updateStatus = useUpdateStore((state) => state.status);
  const checkForUpdates = useUpdateStore((state) => state.check);
  const updateBusy = isUpdateBusy(updateStatus);

  const openFeedback = () => {
    if (platform.openExternalUrl) {
      void platform.openExternalUrl(GITHUB_ISSUES_URL);
      return;
    }
    window.open(GITHUB_ISSUES_URL, "_blank", "noopener,noreferrer");
  };

  const openArchive = async () => {
    const path = await platform.pickArchive?.();
    if (path) {
      navigate("/gallery");
      void startArchiveScan(path, { libraryEffect: "ensure" });
    }
  };

  const openFolder = () => {
    navigate("/gallery");
    void openFolderAndScan();
  };

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 flex h-9 items-center border-b bg-popover/95 px-2 text-popover-foreground shadow-xs backdrop-blur"
      {...(draggable ? { "data-tauri-drag-region": true } : {})}
    >
      <img
        src="/logo/logo.svg"
        alt="MasonGallery"
        className="mr-1 size-5 shrink-0"
      />

      <DropdownMenu>
        <MenuButton>{t("menu:file")}</MenuButton>
        <DropdownMenuContent className="min-w-56">
          <DropdownMenuItem onClick={openFolder}>
            <FolderOpen data-icon="inline-start" />
            {t("menu:openFolder")}
          </DropdownMenuItem>
          {platform.capabilities.canBrowseArchives && platform.pickArchive && (
            <DropdownMenuItem onClick={() => void openArchive()}>
              <Archive data-icon="inline-start" />
              {t("archive:openArchive")}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              resetToDropZone();
              navigate("/library");
            }}
          >
            <RotateCcw data-icon="inline-start" />
            {t("menu:reset")}
          </DropdownMenuItem>
          {onQuit && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onQuit}>
                <X data-icon="inline-start" />
                {t("menu:quit")}
                <DropdownMenuShortcut>Alt+F4</DropdownMenuShortcut>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <MenuButton>{t("menu:view")}</MenuButton>
        <DropdownMenuContent className="min-w-56">
          <DropdownMenuItem onClick={() => navigate("/library")}>
            <Home data-icon="inline-start" />
            {t("actions:gallery")}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!hasGallery} onClick={toggleSidebar}>
            <Folder data-icon="inline-start" />
            {t("sidebar:folders")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={toggleQuickPanel}>
            <Settings data-icon="inline-start" />
            {t("actions:quickControls")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => incrementalRefresh()}>
            <RefreshCw data-icon="inline-start" />
            {t("actions:refresh")}
          </DropdownMenuItem>
          {platform.capabilities.canBrowseArchives && (
            <DropdownMenuItem onClick={() => navigate("/manage/cache")}>
              <Database data-icon="inline-start" />
              {t("archive:manageCache")}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate("/settings/general")}>
            <SlidersHorizontal data-icon="inline-start" />
            {t("actions:preferences")}
          </DropdownMenuItem>
          {onDevTools && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDevTools}>
                <MonitorCog data-icon="inline-start" />
                {t("menu:devTools")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <MenuButton>{t("menu:help")}</MenuButton>
        <DropdownMenuContent className="min-w-40">
          {canAutoUpdate && (
            <DropdownMenuItem
              disabled={updateBusy}
              onClick={() => {
                void checkForUpdates("manual");
              }}
            >
              <RefreshCw data-icon="inline-start" />
              {t("menu:checkForUpdates")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={openFeedback}>
            <MessageSquare data-icon="inline-start" />
            {t("menu:feedback")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate("/about")}>
            <Info data-icon="inline-start" />
            {t("menu:about")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div
        className="min-w-4 flex-1"
        {...(draggable ? { "data-tauri-drag-region": true } : {})}
      />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        title={t("sidebar:folders")}
        disabled={!hasGallery}
        onClick={toggleSidebar}
      >
        <Folder />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        title={t("actions:refresh")}
        onClick={() => incrementalRefresh()}
      >
        <RefreshCw />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        title={t("actions:quickControls")}
        onClick={toggleQuickPanel}
      >
        <Settings />
      </Button>

      <div className={cn("ml-1 flex h-9 items-center")}>{trailing}</div>
    </header>
  );
}
