import { setPlatform } from "@mason-gallery/core";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { tauriPlatformService } from "./adapters/TauriPlatformService";
import "@mason-gallery/core/src/index.css";

setPlatform(tauriPlatformService);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
