import { ChevronDown, ChevronRight, Folder } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/appStore";

interface TreeNode {
  name: string;
  path: string;
  children: TreeNode[];
}

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode[] = [];
  const nodeMap = new Map<string, TreeNode>();

  for (const path of paths) {
    const parts = path.split("/");
    let current = root;
    let currentPath = "";

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      let node = nodeMap.get(currentPath);
      if (!node) {
        node = { name: part, path: currentPath, children: [] };
        nodeMap.set(currentPath, node);
        current.push(node);
      }
      current = node.children;
    }
  }

  return root;
}

export const SIDEBAR_WIDTH = 260;

function useSmallScreen() {
  const [isSmall, setIsSmall] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const update = () => setIsSmall(window.innerWidth <= 768);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return isSmall;
}

function FolderTreeNode({ node, depth }: { node: TreeNode; depth: number }) {
  const selectedFolder = useAppStore((s) => s.selectedFolder);
  const expandedFolders = useAppStore((s) => s.expandedFolders);
  const folderImageCounts = useAppStore((s) => s.folderImageCounts);
  const setSelectedFolder = useAppStore((s) => s.setSelectedFolder);
  const toggleExpandedFolder = useAppStore((s) => s.toggleExpandedFolder);

  const isExpanded = expandedFolders.includes(node.path);
  const isSelected = selectedFolder === node.path;
  const count = folderImageCounts[node.path] ?? 0;
  const hasChildren = node.children.length > 0;

  return (
    <>
      <div
        className={cn(
          "flex min-h-8 w-full items-center pr-2 text-sm hover:bg-accent hover:text-accent-foreground",
          isSelected && "bg-accent text-accent-foreground",
        )}
        style={{ paddingLeft: 8 + depth * 16 }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="flex size-5 items-center justify-center"
            aria-label={node.name}
            aria-expanded={isExpanded}
            onClick={() => toggleExpandedFolder(node.path)}
          >
            {isExpanded ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </button>
        ) : (
          <span className="size-5" />
        )}
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1 py-1 text-left"
          onClick={() => setSelectedFolder(node.path)}
        >
          <Folder className="size-4 shrink-0" />
          <span className="truncate">{node.name}</span>
          {count > 0 && (
            <span className="ml-auto text-xs text-muted-foreground">
              {count}
            </span>
          )}
        </button>
      </div>
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <FolderTreeNode key={child.path} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </>
  );
}

export default function FolderSidebar() {
  const t = useI18n();
  const isSidebarOpen = useAppStore((s) => s.isSidebarOpen);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const directoryTree = useAppStore((s) => s.directoryTree);
  const selectedFolder = useAppStore((s) => s.selectedFolder);
  const setSelectedFolder = useAppStore((s) => s.setSelectedFolder);
  const isSmallScreen = useSmallScreen();

  const tree = useMemo(() => buildTree(directoryTree), [directoryTree]);

  const drawerContent = (
    <div className="h-full overflow-auto">
      <h2 className="px-4 pb-2 pt-3 text-sm font-semibold">
        {t("sidebar:folders")}
      </h2>
      <button
        type="button"
        className={cn(
          "flex min-h-8 w-full items-center gap-1 px-2 py-1 text-left text-sm hover:bg-accent hover:text-accent-foreground",
          selectedFolder === null && "bg-accent text-accent-foreground",
        )}
        onClick={() => setSelectedFolder(null)}
      >
        <span className="size-5" />
        <Folder className="size-4 shrink-0" />
        <span>{t("sidebar:showAll")}</span>
      </button>
      {tree.map((node) => (
        <FolderTreeNode key={node.path} node={node} depth={0} />
      ))}
      {tree.length === 0 && (
        <p className="px-4 py-2 text-sm text-muted-foreground">
          {t("sidebar:noSubfolders")}
        </p>
      )}
    </div>
  );

  if (isSmallScreen) {
    return (
      <>
        {isSidebarOpen && (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/25"
            aria-label={t("actions:close")}
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <aside
          className={cn(
            "sidebar-gallery fixed bottom-0 left-0 top-9 z-50 w-[260px] border-r border-border bg-popover text-popover-foreground shadow-xl transition-transform",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          {drawerContent}
        </aside>
      </>
    );
  }

  if (!isSidebarOpen) return null;

  return (
    <aside className="sidebar-gallery h-full w-[260px] shrink-0 overflow-hidden border-r border-border bg-background">
      {drawerContent}
    </aside>
  );
}
