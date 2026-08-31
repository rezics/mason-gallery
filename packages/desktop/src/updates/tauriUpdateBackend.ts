import type { UpdateBackend } from "@mason-gallery/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";

let pendingUpdate: Update | null = null;

async function discardPendingUpdate(): Promise<void> {
  const current = pendingUpdate;
  pendingUpdate = null;
  if (!current) return;
  try {
    await current.close();
  } catch {
    // The previous Update handle is only advisory; a later check still proceeds.
  }
}

export const tauriUpdateBackend: UpdateBackend = {
  async check() {
    await discardPendingUpdate();
    const update = await check();
    if (!update) return null;
    pendingUpdate = update;
    return { version: update.version };
  },

  async install() {
    const update = pendingUpdate;
    if (!update) {
      throw new Error("No update is available to install");
    }
    await update.downloadAndInstall();
    await relaunch();
  },
};
