import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const sourcePath = path.resolve(packageRoot, "../../public/logo/banner.svg");
const outputPath = path.resolve(packageRoot, "dist/logo/og-image.png");

await mkdir(path.dirname(outputPath), { recursive: true });

await sharp(sourcePath, { density: 192 })
  .resize(1040, 306, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .extend({
    top: 162,
    bottom: 162,
    left: 80,
    right: 80,
    background: "#fcf8f7",
  })
  .flatten({ background: "#fcf8f7" })
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(outputPath);

console.log(`Generated ${outputPath} from ${sourcePath}`);
