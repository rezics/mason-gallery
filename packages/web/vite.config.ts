import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@mason-gallery/core/src": path.resolve(__dirname, "../core/src"),
      "@mason-gallery/core": path.resolve(__dirname, "../core/src/index.ts"),
      "@/": path.resolve(__dirname, "../core/src") + "/",
    },
  },
  base: "./",
  build: {
    outDir: "dist",
  },
});
