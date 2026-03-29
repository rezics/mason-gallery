import { createContext, useContext } from "react";
import type { PlatformService } from "../types/platform";

const PlatformContext = createContext<PlatformService | null>(null);

export function usePlatform(): PlatformService {
  const platform = useContext(PlatformContext);
  if (!platform) {
    throw new Error("usePlatform must be used within a PlatformContext.Provider");
  }
  return platform;
}

// Module-level accessor for use outside React (e.g., in stores)
let _platform: PlatformService | null = null;

export function setPlatform(platform: PlatformService): void {
  _platform = platform;
}

export function getPlatform(): PlatformService {
  if (!_platform) {
    throw new Error("setPlatform() must be called before getPlatform()");
  }
  return _platform;
}

export { PlatformContext };
