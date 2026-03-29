import { PlatformContext, Shell } from "@mason-gallery/core";
import { webPlatformService } from "./adapters/WebPlatformService";

export default function App() {
  return (
    <PlatformContext.Provider value={webPlatformService}>
      <Shell titlebar={null} updateChecker={null} />
    </PlatformContext.Provider>
  );
}
