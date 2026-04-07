import { MenuBar, PlatformContext, Shell } from "@mason-gallery/core";
import { webPlatformService } from "./adapters/WebPlatformService";

export default function App() {
  return (
    <PlatformContext.Provider value={webPlatformService}>
      <Shell titlebar={<MenuBar />} updateChecker={null} />
    </PlatformContext.Provider>
  );
}
