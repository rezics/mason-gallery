import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useAppStore } from "@/stores/appStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useViewerStore } from "@/stores/viewerStore";
import type { ScanParams } from "@/types";

export async function startScan(paths: string[]) {
  const { resetAndScan, setScanning } = useViewerStore.getState();
  const { setFolders } = useAppStore.getState();
  const { formats, sortMethod, pageSize } = useSettingsStore.getState();

  resetAndScan();
  setFolders(paths);

  const params: ScanParams = {
    paths,
    formats,
    page_size: pageSize,
    sort_method: sortMethod,
  };

  try {
    await invoke("scan_directory", { params });
  } catch (e) {
    console.error("Scan failed:", e);
    setScanning(false);
  }
}

export async function openFolderAndScan() {
  const selected = await open({ directory: true, multiple: true });
  if (!selected) return;
  const paths = Array.isArray(selected) ? selected : [selected];
  if (paths.length > 0) {
    await startScan(paths);
  }
}

export function refresh() {
  const { folders } = useAppStore.getState();
  if (folders.length > 0) {
    startScan(folders);
  }
}

export function resetToDropZone() {
  useViewerStore.getState().reset();
  useAppStore.getState().setFolders([]);
}
