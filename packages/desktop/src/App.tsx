import { PlatformContext } from "@mason-gallery/core";
import { tauriPlatformService } from "./adapters/TauriPlatformService";
import { DesktopApp } from "./app/DesktopApp";
import Titlebar from "./components/Titlebar";
import UpdateChecker from "./components/UpdateChecker";

export default function App() {
  return (
    <PlatformContext.Provider value={tauriPlatformService}>
      <DesktopApp titlebar={<Titlebar />} updateChecker={<UpdateChecker />} />
    </PlatformContext.Provider>
  );
}
