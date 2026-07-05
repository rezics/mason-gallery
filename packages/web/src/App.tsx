import { PlatformContext } from "@mason-gallery/core";
import { webPlatformService } from "./adapters/WebPlatformService";
import { WebApp } from "./app/WebApp";

export default function App() {
  return (
    <PlatformContext.Provider value={webPlatformService}>
      <WebApp />
    </PlatformContext.Provider>
  );
}
