import React from "react";
import ReactDOM from "react-dom/client";
import { setPlatform } from "@wviewer/core";
import { webPlatformService } from "./adapters/WebPlatformService";
import App from "./App";
import "@wviewer/core/src/index.css";

setPlatform(webPlatformService);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
