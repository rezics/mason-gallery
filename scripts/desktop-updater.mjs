import { execFileSync } from "node:child_process";
import { createHash, createPublicKey, verify } from "node:crypto";
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const configPath = "packages/desktop/src-tauri/tauri.conf.json";
export const requiredTargets = [
  "windows-x86_64",
  "windows-x86_64-nsis",
  "windows-x86_64-msi",
  "darwin-aarch64",
  "darwin-x86_64",
  "linux-x86_64",
];

function command(program, args, options = {}) {
  return execFileSync(program, args, {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
    ...options,
  });
}

function gh(args) {
  return command("gh", args);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function decodeBase64(value) {
  assert(
    typeof value === "string" && /^[A-Za-z0-9+/]+={0,2}$/.test(value.trim()),
    "Invalid base64 data",
  );
  const bytes = Buffer.from(value.trim(), "base64");
  assert(bytes.toString("base64") === value.trim(), "Invalid base64 encoding");
  return bytes;
}

// Tauri stores base64-encoded Minisign documents. Verify both the file signature
// and the trusted comment, with the same Ed/ED modes as minisign-verify.
export function verifyUpdaterSignature(
  content,
  encodedSignature,
  encodedPublicKey,
) {
  const keyLines = decodeBase64(encodedPublicKey)
    .toString("utf8")
    .trim()
    .split(/\r?\n/);
  const key = decodeBase64(keyLines[1]);
  const lines = decodeBase64(encodedSignature)
    .toString("utf8")
    .trim()
    .split(/\r?\n/);
  assert(
    key.length === 42 && key.subarray(0, 2).toString() === "Ed",
    "Invalid updater public key",
  );
  assert(
    lines.length === 4 &&
      lines[0].startsWith("untrusted comment: ") &&
      lines[2].startsWith("trusted comment: "),
    "Invalid updater signature document",
  );
  const packet = decodeBase64(lines[1]);
  const globalSignature = decodeBase64(lines[3]);
  assert(
    packet.length === 74 && globalSignature.length === 64,
    "Invalid updater signature length",
  );
  assert(
    packet.subarray(2, 10).equals(key.subarray(2, 10)),
    "Signing key does not match the client's updater public key",
  );
  const algorithm = packet.subarray(0, 2).toString();
  assert(
    algorithm === "Ed" || algorithm === "ED",
    "Unsupported updater signature algorithm",
  );
  const publicKey = createPublicKey({
    key: Buffer.concat([
      Buffer.from("302a300506032b6570032100", "hex"),
      key.subarray(10),
    ]),
    format: "der",
    type: "spki",
  });
  const message =
    algorithm === "ED"
      ? createHash("blake2b512").update(content).digest()
      : content;
  const signature = packet.subarray(10);
  assert(
    verify(null, message, publicKey, signature),
    "Updater artifact signature verification failed",
  );
  assert(
    verify(
      null,
      Buffer.concat([signature, Buffer.from(lines[2].slice(17))]),
      publicKey,
      globalSignature,
    ),
    "Updater trusted comment verification failed",
  );
}

function getConfig(tag) {
  const text = tag
    ? command("git", ["show", `${tag}:${configPath}`])
    : readFileSync(join(root, configPath), "utf8");
  return JSON.parse(text);
}

function validateTag(tag) {
  assert(
    /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tag ?? ""),
    "Expected a release tag such as v2.2.0",
  );
}

function getRelease(tag) {
  return JSON.parse(
    gh([
      "api",
      `repos/${process.env.GITHUB_REPOSITORY ?? "rezics/mason-gallery"}/releases/tags/${tag}`,
    ]),
  );
}

function download(tag, asset, directory) {
  assert(
    basename(asset.name) === asset.name && !asset.name.includes("\\"),
    "Unsafe release asset name",
  );
  gh(["release", "download", tag, "--pattern", asset.name, "--dir", directory]);
  const file = join(directory, asset.name);
  const content = readFileSync(file);
  assert(content.length === asset.size, `Asset size mismatch: ${asset.name}`);
  if (asset.digest) {
    assert(
      asset.digest ===
        `sha256:${createHash("sha256").update(content).digest("hex")}`,
      `Asset digest mismatch: ${asset.name}`,
    );
  }
  return { file, content };
}

export function releaseAssetUrl(release, asset) {
  // Draft assets can have untagged download URLs that stop working on publication.
  return asset.browser_download_url.replace(
    /\/download\/untagged-[^/]+\//,
    `/download/${encodeURIComponent(release.tag_name)}/`,
  );
}

export function validateManifest(manifest, release) {
  assert(
    manifest && typeof manifest === "object" && !Array.isArray(manifest),
    "Invalid updater manifest",
  );
  assert(
    manifest.version === release.tag_name.slice(1),
    "Updater version does not match the release tag",
  );
  assert(
    manifest.platforms &&
      typeof manifest.platforms === "object" &&
      !Array.isArray(manifest.platforms),
    "Missing updater platforms",
  );
  if (manifest.pub_date !== undefined)
    assert(
      Number.isFinite(Date.parse(manifest.pub_date)),
      "Invalid updater publication date",
    );
  for (const target of requiredTargets)
    assert(
      Object.hasOwn(manifest.platforms, target),
      `Missing updater platform: ${target}`,
    );
  return Object.entries(manifest.platforms).map(([target, entry]) => {
    assert(
      entry &&
        typeof entry.url === "string" &&
        typeof entry.signature === "string" &&
        entry.signature.length > 0,
      `Incomplete updater platform: ${target}`,
    );
    const asset = release.assets.find(
      (item) => releaseAssetUrl(release, item) === entry.url,
    );
    assert(
      asset && entry.url.startsWith("https://github.com/"),
      `Updater URL is not a release asset: ${target}`,
    );
    return { target, entry, asset };
  });
}

function withTemp(work) {
  const directory = mkdtempSync(join(tmpdir(), "mason-updater-"));
  try {
    return work(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function signFile(file, pubkey) {
  assert(
    process.env.TAURI_SIGNING_PRIVATE_KEY?.trim(),
    "TAURI_SIGNING_PRIVATE_KEY is missing",
  );
  // Capture CLI output so private-key parsing failures never print secret input.
  try {
    command(
      process.execPath,
      ["x", "--no-install", "tauri", "signer", "sign", file],
      { cwd: join(root, "packages/desktop") },
    );
  } catch (error) {
    if (error?.stderr?.toString().includes("Wrong password for that key")) {
      throw new Error(
        "TAURI_SIGNING_PRIVATE_KEY_PASSWORD does not decrypt the existing signing key.",
      );
    }
    throw new Error(
      "Updater signing failed. Check the signing private key and password secrets.",
    );
  }
  const signature = readFileSync(`${file}.sig`, "utf8").trim();
  verifyUpdaterSignature(readFileSync(file), signature, pubkey);
  return signature;
}

function preflight(tag) {
  const config = getConfig();
  assert(
    config.version === tag.slice(1),
    "Release tag does not match tauri.conf.json version",
  );
  assert(
    config.bundle.createUpdaterArtifacts === true,
    "bundle.createUpdaterArtifacts must be true",
  );
  assert(
    config.plugins.updater.endpoints.includes(
      `https://github.com/${process.env.GITHUB_REPOSITORY ?? "rezics/mason-gallery"}/releases/latest/download/latest.json`,
    ),
    "Updater endpoint does not match the release repository",
  );
  verifySigning();
  // An existing published release must use repair mode; do not replace its binaries.
  const releases = JSON.parse(
    gh([
      "api",
      `repos/${process.env.GITHUB_REPOSITORY ?? "rezics/mason-gallery"}/releases?per_page=100`,
    ]),
  );
  assert(
    !releases.some((release) => release.tag_name === tag && !release.draft),
    "Release is already published. Use repair_only to repair updater metadata.",
  );
  console.log("Updater configuration and signing key verified.");
}

function verifySigning() {
  withTemp((directory) => {
    const file = join(directory, "signing-check.txt");
    writeFileSync(file, "MasonGallery updater signing preflight\n");
    signFile(file, getConfig().plugins.updater.pubkey);
  });
  console.log("Updater signing credentials match the configured public key.");
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? walk(join(directory, entry.name))
      : [join(directory, entry.name)],
  );
}

function validateLocal(directory, target) {
  assert(requiredTargets.includes(target), "Unsupported build target");
  const files = walk(resolve(directory)).filter((file) => {
    if (target.startsWith("windows-"))
      return /(?:-setup\.exe|\.msi)$/.test(file);
    if (target.startsWith("darwin-")) return file.endsWith(".app.tar.gz");
    return file.endsWith(".AppImage");
  });
  assert(files.length > 0, `No updater bundles found for ${target}`);
  for (const file of files) {
    verifyUpdaterSignature(
      readFileSync(file),
      readFileSync(`${file}.sig`, "utf8").trim(),
      getConfig().plugins.updater.pubkey,
    );
  }
  console.log(`Verified ${files.length} signed updater bundles for ${target}.`);
}

function validateRelease(tag) {
  const release = getRelease(tag);
  const pubkey = getConfig(tag).plugins.updater.pubkey;
  withTemp((directory) => {
    const manifestAsset = release.assets.find(
      (asset) => asset.name === "latest.json",
    );
    assert(manifestAsset, "Release is missing latest.json");
    const manifest = JSON.parse(
      download(tag, manifestAsset, directory).content.toString("utf8"),
    );
    const downloads = new Map();
    for (const { target, entry, asset } of validateManifest(
      manifest,
      release,
    )) {
      if (!downloads.has(asset.name))
        downloads.set(asset.name, download(tag, asset, directory).content);
      verifyUpdaterSignature(
        downloads.get(asset.name),
        entry.signature,
        pubkey,
      );
      console.log(`Verified published updater artifact: ${target}`);
    }
  });
}

function artifactEntries(config, version) {
  const product = config.productName;
  return [
    ["windows-x86_64", `${product}_${version}_x64-setup.exe`],
    ["windows-x86_64-nsis", `${product}_${version}_x64-setup.exe`],
    ["windows-x86_64-msi", `${product}_${version}_x64_en-US.msi`],
    ["darwin-aarch64", `${product}_aarch64.app.tar.gz`],
    ["darwin-aarch64-app", `${product}_aarch64.app.tar.gz`],
    ["darwin-x86_64", `${product}_x64.app.tar.gz`],
    ["darwin-x86_64-app", `${product}_x64.app.tar.gz`],
    ["linux-x86_64", `${product}_${version}_amd64.AppImage`],
    ["linux-x86_64-appimage", `${product}_${version}_amd64.AppImage`],
  ];
}

function assemble(tag, repairOnly) {
  const release = getRelease(tag);
  assert(
    !release.prerelease && release.draft !== repairOnly,
    repairOnly
      ? "Repair requires an existing published stable release"
      : "Updater assembly requires a draft release",
  );
  if (
    repairOnly &&
    release.assets.some((asset) => asset.name === "latest.json")
  ) {
    validateRelease(tag);
    console.log("Existing updater manifest is valid; no changes needed.");
    return;
  }
  const config = getConfig(tag);
  const version = tag.slice(1);
  assert(
    config.version === version,
    "Release tag does not match its original app version",
  );
  const artifacts = artifactEntries(config, version);
  withTemp((directory) => {
    const platforms = {};
    const signed = new Map();
    if (repairOnly) {
      const probe = join(directory, "signing-check.txt");
      writeFileSync(probe, "MasonGallery updater repair signing preflight\n");
      signFile(probe, config.plugins.updater.pubkey);
    }
    for (const [target, name] of artifacts) {
      const asset = release.assets.find((item) => item.name === name);
      assert(
        asset?.digest,
        `Missing release artifact or SHA-256 digest: ${name}`,
      );
      if (!signed.has(name)) {
        const { file, content } = download(tag, asset, directory);
        let signature;
        if (repairOnly)
          signature = signFile(file, config.plugins.updater.pubkey);
        else {
          const signatureAsset = release.assets.find(
            (item) => item.name === `${name}.sig`,
          );
          assert(signatureAsset, `Missing release signature: ${name}.sig`);
          signature = download(tag, signatureAsset, directory)
            .content.toString("utf8")
            .trim();
          verifyUpdaterSignature(
            content,
            signature,
            config.plugins.updater.pubkey,
          );
        }
        signed.set(name, { file, signature });
      }
      platforms[target] = {
        url: releaseAssetUrl(release, asset),
        signature: signed.get(name).signature,
      };
    }
    const manifest = {
      version,
      notes: release.body ?? "",
      pub_date: release.published_at ?? new Date().toISOString(),
      platforms,
    };
    validateManifest(manifest, release);
    const manifestFile = join(directory, "latest.json");
    writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
    // Publish the manifest last, after every artifact has been verified. Binaries,
    // release/tag state and the original publication date remain untouched.
    if (repairOnly)
      for (const { file } of signed.values())
        gh(["release", "upload", tag, `${file}.sig`, "--clobber"]);
    gh([
      "release",
      "upload",
      tag,
      manifestFile,
      ...(repairOnly ? [] : ["--clobber"]),
    ]);
  });
  validateRelease(tag);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [mode, argument, target] = process.argv.slice(2);
  try {
    if (mode === "verify-signing") verifySigning();
    else if (mode === "validate-local") validateLocal(argument, target);
    else {
      validateTag(argument);
      if (mode === "preflight") preflight(argument);
      else if (mode === "validate-release") validateRelease(argument);
      else if (mode === "repair") assemble(argument, true);
      else if (mode === "assemble") assemble(argument, false);
      else
        throw new Error(
          "Expected preflight, validate-local, validate-release, assemble or repair",
        );
    }
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Updater validation failed",
    );
    process.exitCode = 1;
  }
}
