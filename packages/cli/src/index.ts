#!/usr/bin/env node

import { exec } from "node:child_process";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sirv from "sirv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(__dirname, "web");

const port = Number(process.argv[2]) || 0;

const serve = sirv(webDir, { single: true });
const server = createServer(serve);

server.listen(port, () => {
  const addr = server.address();
  const actualPort = typeof addr === "object" && addr ? addr.port : port;
  const url = `http://localhost:${actualPort}`;
  console.log(`MasonGallery running at ${url}`);

  const cmd =
    process.platform === "win32"
      ? `start ${url}`
      : process.platform === "darwin"
        ? `open ${url}`
        : `xdg-open ${url}`;

  exec(cmd, (err: Error | null) => {
    if (err) console.error("Could not open browser:", err.message);
  });
});
