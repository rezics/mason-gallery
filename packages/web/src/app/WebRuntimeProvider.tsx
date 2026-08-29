import { PlatformContext, setPlatform } from "@mason-gallery/core";
import { type ReactNode, StrictMode } from "react";
import { webPlatformService } from "../adapters/WebPlatformService";

setPlatform(webPlatformService);

export function WebRuntimeProvider({ children }: { children: ReactNode }) {
  return (
    <StrictMode>
      <PlatformContext.Provider value={webPlatformService}>
        {children}
      </PlatformContext.Provider>
    </StrictMode>
  );
}
