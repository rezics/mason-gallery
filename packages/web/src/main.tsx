import { setPlatform } from "@mason-gallery/core";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { webPlatformService } from "./adapters/WebPlatformService";
import "@mason-gallery/core/src/index.css";

setPlatform(webPlatformService);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
