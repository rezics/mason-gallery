import { setPlatform } from "@mason-gallery/core";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "@mason-gallery/core/src/index.css";
import { tauriPlatformService } from "./adapters/TauriPlatformService";

async function renderApp() {
  const preview =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).has("preview");
  const platform = preview
    ? (await import("./adapters/PreviewPlatformService")).previewPlatformService
    : tauriPlatformService;
  setPlatform(platform);

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App platform={platform} preview={preview} />
    </React.StrictMode>,
  );
}

void renderApp();
