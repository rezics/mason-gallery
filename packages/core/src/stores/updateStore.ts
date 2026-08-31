import { create } from "zustand";
import { getPlatform } from "@/context/PlatformContext";
import { useSettingsStore } from "@/stores/settingsStore";
import {
  createUpdateController,
  IDLE_UPDATE_SNAPSHOT,
  type UpdateBackend,
  type UpdateCheckReason,
  type UpdateSnapshot,
} from "@/updates/updateController";

const controller = createUpdateController();
let isProductionBuild = false;

interface UpdateStoreState extends UpdateSnapshot {
  check: (reason: UpdateCheckReason) => Promise<UpdateSnapshot>;
  install: () => Promise<UpdateSnapshot>;
  dismiss: () => void;
}

export const useUpdateStore = create<UpdateStoreState>(() => ({
  ...IDLE_UPDATE_SNAPSHOT,
  check: (reason) =>
    controller.check({
      reason,
      canAutoUpdate: getPlatform().capabilities.canAutoUpdate,
      autoCheckEnabled: useSettingsStore.getState().autoCheckUpdates,
      isProductionBuild,
    }),
  install: () => controller.install(),
  dismiss: () => controller.dismiss(),
}));

controller.subscribe((snapshot) => {
  useUpdateStore.setState(snapshot);
});

export function setUpdateBackend(backend: UpdateBackend | null): void {
  controller.setBackend(backend);
}

export function setUpdateProductionBuild(value: boolean): void {
  isProductionBuild = value;
}

export function resetUpdateStore(): void {
  controller.reset();
  isProductionBuild = false;
}
