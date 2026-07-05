import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const host = process.env.TAURI_DEV_HOST;
const coreSrc = path.resolve(__dirname, "../core/src");

export default defineConfig(async () => ({
  publicDir: path.resolve(__dirname, "../../public"),
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: [
      {
        find: /^@mason-gallery\/core\/src\/(.*)$/,
        replacement: `${coreSrc}/$1`,
      },
      {
        find: /^@mason-gallery\/core\/(.*)$/,
        replacement: `${coreSrc}/$1`,
      },
      {
        find: "@mason-gallery/core",
        replacement: path.resolve(coreSrc, "index.ts"),
      },
      {
        find: "@/",
        replacement: `${coreSrc}/`,
      },
    ],
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));

