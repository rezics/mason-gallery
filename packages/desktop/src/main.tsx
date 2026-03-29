import React from "react";
import ReactDOM from "react-dom/client";
import { setPlatform } from "@wviewer/core";
import { tauriPlatformService } from "./adapters/TauriPlatformService";
import App from "./App";
import "@wviewer/core/src/index.css";

setPlatform(tauriPlatformService);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
