import {
  MenuBar,
  PlatformContext,
  type PlatformService,
  setUpdateBackend,
  setUpdateProductionBuild,
} from "@mason-gallery/core";
import { tauriPlatformService } from "./adapters/TauriPlatformService";
import { DesktopApp } from "./app/DesktopApp";
import Titlebar from "./components/Titlebar";
import UpdateChecker from "./components/UpdateChecker";
import { tauriUpdateBackend } from "./updates/tauriUpdateBackend";

export default function App({
  platform = tauriPlatformService,
  preview = false,
}: {
  platform?: PlatformService;
  preview?: boolean;
}) {
  setUpdateBackend(preview ? null : tauriUpdateBackend);
  setUpdateProductionBuild(import.meta.env.PROD);

  return (
    <PlatformContext.Provider value={platform}>
      <DesktopApp
        titlebar={preview ? <MenuBar /> : <Titlebar />}
        updateChecker={!preview ? <UpdateChecker /> : null}
      />
    </PlatformContext.Provider>
  );
}
