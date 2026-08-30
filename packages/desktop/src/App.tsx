import {
  MenuBar,
  PlatformContext,
  type PlatformService,
} from "@mason-gallery/core";
import { tauriPlatformService } from "./adapters/TauriPlatformService";
import { DesktopApp } from "./app/DesktopApp";
import Titlebar from "./components/Titlebar";
import UpdateChecker from "./components/UpdateChecker";

export default function App({
  platform = tauriPlatformService,
  preview = false,
}: {
  platform?: PlatformService;
  preview?: boolean;
}) {
  return (
    <PlatformContext.Provider value={platform}>
      <DesktopApp
        titlebar={preview ? <MenuBar /> : <Titlebar />}
        updateChecker={
          import.meta.env.PROD && !preview ? <UpdateChecker /> : null
        }
      />
    </PlatformContext.Provider>
  );
}
