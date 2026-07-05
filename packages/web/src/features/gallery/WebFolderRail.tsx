import { useAppStore, useI18n, useViewerStore } from "@mason-gallery/core";
import { ChevronDown, ChevronRight, Folder } from "lucide-react";
import { useMemo } from "react";

type TreeNode = {
  name: string;
  path: string;
  children: TreeNode[];
};

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode[] = [];
  const nodeMap = new Map<string, TreeNode>();

  for (const path of paths) {
    const parts = path.split("/").filter(Boolean);
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

function FolderRow({ node, depth }: { node: TreeNode; depth: number }) {
  const selectedFolder = useAppStore((s) => s.selectedFolder);
  const expandedFolders = useAppStore((s) => s.expandedFolders);
  const folderImageCounts = useAppStore((s) => s.folderImageCounts);
  const setSelectedFolder = useAppStore((s) => s.setSelectedFolder);
  const toggleExpandedFolder = useAppStore((s) => s.toggleExpandedFolder);

  const isExpanded = expandedFolders.includes(node.path);
  const isSelected = selectedFolder === node.path;
  const hasChildren = node.children.length > 0;
  const count = folderImageCounts[node.path] ?? 0;

  return (
    <div>
      <div
        className={`group flex min-h-9 items-center gap-1 rounded-md pr-2 text-sm transition ${
          isSelected
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        }`}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="grid size-6 place-items-center rounded text-muted-foreground hover:text-foreground"
            onClick={() => toggleExpandedFolder(node.path)}
            aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
          >
            {isExpanded ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </button>
        ) : (
          <span className="size-6" />
        )}
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left"
          onClick={() => setSelectedFolder(node.path)}
        >
          <Folder className="size-4 shrink-0" />
          <span className="truncate">{node.name}</span>
          {count > 0 && (
            <span className="ml-auto rounded bg-background/70 px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {count}
            </span>
          )}
        </button>
      </div>
      {hasChildren && isExpanded && (
        <div className="mt-1 space-y-1">
          {node.children.map((child) => (
            <FolderRow key={child.path} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function WebFolderRail() {
  const t = useI18n();
  const directoryTree = useAppStore((s) => s.directoryTree);
  const isSidebarOpen = useAppStore((s) => s.isSidebarOpen);
  const selectedFolder = useAppStore((s) => s.selectedFolder);
  const setSelectedFolder = useAppStore((s) => s.setSelectedFolder);
  const totalImageCount = useViewerStore((s) => s.images.length);

  const tree = useMemo(() => buildTree(directoryTree), [directoryTree]);

  if (!isSidebarOpen) return null;

  return (
    <aside className="absolute inset-y-0 left-0 z-20 w-72 shrink-0 border-r border-border bg-background/95 p-4 shadow-xl backdrop-blur md:relative md:z-auto md:bg-background/80 md:shadow-none">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">
          {t("sidebar:folders")}
        </h2>
        {totalImageCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {totalImageCount}
          </span>
        )}
      </div>
      <div className="space-y-1">
        <button
          type="button"
          className={`flex min-h-9 w-full items-center gap-2 rounded-md px-3 text-left text-sm transition ${
            selectedFolder === null
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          }`}
          onClick={() => setSelectedFolder(null)}
        >
          <Folder className="size-4" />
          <span>{t("sidebar:showAll")}</span>
          {totalImageCount > 0 && (
            <span className="ml-auto rounded bg-background/70 px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {totalImageCount}
            </span>
          )}
        </button>
        {tree.map((node) => (
          <FolderRow key={node.path} node={node} depth={0} />
        ))}
        {tree.length === 0 && (
          <p className="px-3 py-2 text-sm text-muted-foreground">
            {t("sidebar:noSubfolders")}
          </p>
        )}
      </div>
    </aside>
  );
}
