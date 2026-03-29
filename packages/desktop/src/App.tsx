import { PlatformContext, Shell } from "@mason-gallery/core";
import { tauriPlatformService } from "./adapters/TauriPlatformService";
import Titlebar from "./components/Titlebar";
import UpdateChecker from "./components/UpdateChecker";

export default function App() {
  return (
    <PlatformContext.Provider value={tauriPlatformService}>
      <Shell titlebar={<Titlebar />} updateChecker={<UpdateChecker />} />
    </PlatformContext.Provider>
  );
}
