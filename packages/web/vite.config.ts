import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  publicDir: path.resolve(__dirname, "../../public"),
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@/": path.resolve(__dirname, "../core/src") + "/",
    },
  },
  base: "./",
  build: {
    outDir: "dist",
  },
});
