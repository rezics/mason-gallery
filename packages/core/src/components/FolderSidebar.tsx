import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FolderIcon from "@mui/icons-material/Folder";
import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useMemo } from "react";
import { useI18n } from "@/i18n";
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
      <ListItemButton
        selected={isSelected}
        onClick={() => setSelectedFolder(node.path)}
        sx={{ pl: 1 + depth * 2, py: 0.25, minHeight: 32 }}
      >
        {hasChildren ? (
          <ListItemIcon
            sx={{ minWidth: 24, cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              toggleExpandedFolder(node.path);
            }}
          >
            {isExpanded ? (
              <ExpandMoreIcon fontSize="small" />
            ) : (
              <ChevronRightIcon fontSize="small" />
            )}
          </ListItemIcon>
        ) : (
          <ListItemIcon sx={{ minWidth: 24 }}>
            <Box sx={{ width: 20 }} />
          </ListItemIcon>
        )}
        <ListItemIcon sx={{ minWidth: 28 }}>
          <FolderIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText
          primary={node.name}
          primaryTypographyProps={{ variant: "body2", noWrap: true }}
        />
        {count > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
            {count}
          </Typography>
        )}
      </ListItemButton>
      {hasChildren && isExpanded && (
        <List disablePadding>
          {node.children.map((child) => (
            <FolderTreeNode key={child.path} node={child} depth={depth + 1} />
          ))}
        </List>
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

  const isSmallScreen = useMediaQuery("(max-width:768px)");

  const tree = useMemo(() => buildTree(directoryTree), [directoryTree]);

  const drawerContent = (
    <Box sx={{ width: SIDEBAR_WIDTH, height: "100%", overflow: "auto" }}>
      <Typography variant="subtitle2" sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
        {t.sidebar.folders}
      </Typography>
      <List disablePadding dense>
        <ListItemButton
          selected={selectedFolder === null}
          onClick={() => setSelectedFolder(null)}
          sx={{ pl: 1, py: 0.25, minHeight: 32 }}
        >
          <ListItemIcon sx={{ minWidth: 24 }}>
            <Box sx={{ width: 20 }} />
          </ListItemIcon>
          <ListItemIcon sx={{ minWidth: 28 }}>
            <FolderIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary={t.sidebar.showAll}
            primaryTypographyProps={{ variant: "body2" }}
          />
        </ListItemButton>
        {tree.map((node) => (
          <FolderTreeNode key={node.path} node={node} depth={0} />
        ))}
      </List>
      {tree.length === 0 && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ px: 2, py: 1 }}
        >
          {t.sidebar.noSubfolders}
        </Typography>
      )}
    </Box>
  );

  if (isSmallScreen) {
    return (
      <Drawer
        variant="temporary"
        open={isSidebarOpen}
        onClose={() => setSidebarOpen(false)}
        sx={{ "& .MuiDrawer-paper": { width: SIDEBAR_WIDTH } }}
      >
        {drawerContent}
      </Drawer>
    );
  }

  if (!isSidebarOpen) return null;

  return (
    <Box
      sx={{
        width: SIDEBAR_WIDTH,
        flexShrink: 0,
        borderRight: 1,
        borderColor: "divider",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {drawerContent}
    </Box>
  );
}
