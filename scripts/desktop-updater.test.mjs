import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import {
  createHash,
  generateKeyPairSync,
  randomBytes,
  sign,
} from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  artifactEntries,
  getRelease,
  requiredTargets,
  validateManifest,
  verifyUpdaterSignature,
} from "./desktop-updater.mjs";

function signedFixture(mode = "ED") {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const id = randomBytes(8);
  const content = Buffer.from("MasonGallery updater artifact");
  const key = Buffer.concat([
    Buffer.from("Ed"),
    id,
    publicKey.export({ format: "der", type: "spki" }).subarray(-32),
  ]);
  const encodedKey = Buffer.from(
    `untrusted comment: test key\n${key.toString("base64")}\n`,
  ).toString("base64");
  const message =
    mode === "ED" ? createHash("blake2b512").update(content).digest() : content;
  const signature = sign(null, message, privateKey);
  const packet = Buffer.concat([Buffer.from(mode), id, signature]);
  const comment = "timestamp:12345\tfile:artifact";
  const globalSignature = sign(
    null,
    Buffer.concat([signature, Buffer.from(comment)]),
    privateKey,
  );
  const document = `untrusted comment: test signature\n${packet.toString("base64")}\ntrusted comment: ${comment}\n${globalSignature.toString("base64")}\n`;
  return {
    content,
    encodedKey,
    signature: Buffer.from(document).toString("base64"),
    document,
  };
}

describe("updater artifact verification", () => {
  test("verifies an artifact signed by the installed Tauri CLI", () => {
    const directory = mkdtempSync(join(tmpdir(), "mason-updater-test-"));
    const env = { ...process.env };
    delete env.TAURI_SIGNING_PRIVATE_KEY;
    delete env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD;
    env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "";
    const cli = (args) =>
      execFileSync(
        process.execPath,
        ["x", "--no-install", "tauri", "signer", ...args],
        {
          cwd: fileURLToPath(new URL("../packages/desktop/", import.meta.url)),
          stdio: "pipe",
          env,
        },
      );
    try {
      const keyFile = join(directory, "test.key");
      const artifact = join(directory, "artifact.exe");
      cli(["generate", "--ci", "-w", keyFile]);
      writeFileSync(artifact, "Tauri CLI signature compatibility fixture\n");
      cli(["sign", "--private-key-path", keyFile, artifact]);
      verifyUpdaterSignature(
        readFileSync(artifact),
        readFileSync(`${artifact}.sig`, "utf8").trim(),
        readFileSync(`${keyFile}.pub`, "utf8").trim(),
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }, 20_000);
  for (const mode of ["Ed", "ED"]) {
    test(`accepts ${mode} signatures and rejects changed artifact bytes`, () => {
      const fixture = signedFixture(mode);
      expect(() =>
        verifyUpdaterSignature(
          fixture.content,
          fixture.signature,
          fixture.encodedKey,
        ),
      ).not.toThrow();
      expect(() =>
        verifyUpdaterSignature(
          Buffer.from("different artifact"),
          fixture.signature,
          fixture.encodedKey,
        ),
      ).toThrow("signature verification failed");
    });
  }

  test("rejects a different signing key and altered trusted comments", () => {
    const fixture = signedFixture();
    expect(() =>
      verifyUpdaterSignature(
        fixture.content,
        fixture.signature,
        signedFixture().encodedKey,
      ),
    ).toThrow("does not match");
    const changed = Buffer.from(
      fixture.document.replace("timestamp:12345", "timestamp:99999"),
    ).toString("base64");
    expect(() =>
      verifyUpdaterSignature(fixture.content, changed, fixture.encodedKey),
    ).toThrow("trusted comment verification failed");
  });

  test("accepts the independent prehashed test vector from minisign-verify", () => {
    const pubkey = Buffer.from(
      "untrusted comment: test key\nRWQf6LRCGA9i53mlYecO4IzT51TGPpvWucNSCh1CBM0QTaLn73Y7GFO3\n",
    ).toString("base64");
    const signature = Buffer.from(
      "untrusted comment: signature from minisign secret key\nRUQf6LRCGA9i559r3g7V1qNyJDApGip8MfqcadIgT9CuhV3EMhHoN1mGTkUidF/z7SrlQgXdy8ofjb7bNJJylDOocrCo8KLzZwo=\ntrusted comment: timestamp:1633700835\tfile:test\tprehashed\nwLMDjy9FLAuxZ3q4NlEvkgtyhrr0gtTu6KC4KBJdITbbOeAi1zBIYo0v4iTgt8jJpIidRJnp94ABQkJAgAooBQ==\n",
    ).toString("base64");
    expect(() =>
      verifyUpdaterSignature(Buffer.from("test"), signature, pubkey),
    ).not.toThrow();
  });

  test("rejects malformed signatures", () => {
    const fixture = signedFixture();
    expect(() =>
      verifyUpdaterSignature(fixture.content, "not-base64", fixture.encodedKey),
    ).toThrow();
  });
});

function manifestFixture() {
  const url =
    "https://github.com/rezics/mason-gallery/releases/download/v2.2.0/artifact";
  const release = {
    tag_name: "v2.2.0",
    assets: [{ name: "artifact", browser_download_url: url }],
  };
  const manifest = {
    version: "2.2.0",
    platforms: Object.fromEntries(
      requiredTargets.map((target) => [
        target,
        { url, signature: "signature" },
      ]),
    ),
  };
  return { release, manifest };
}

describe("complete updater manifest", () => {
  test("uses configured installer types and does not require MSI for an NSIS-only release", () => {
    const config = { productName: "MasonGallery" };
    const entries = artifactEntries(config, "2.2.1", {
      windows: ["nsis"],
      linux: ["appimage", "deb", "rpm"],
    });
    expect(entries.some(([target]) => target === "windows-x86_64-msi")).toBe(
      false,
    );
    expect(entries.find(([target]) => target === "windows-x86_64")[1]).toBe(
      "MasonGallery_2.2.1_x64-setup.exe",
    );
    expect(entries.find(([target]) => target === "linux-x86_64-deb")[1]).toBe(
      "MasonGallery_2.2.1_amd64.deb",
    );
    expect(entries.find(([target]) => target === "linux-x86_64-rpm")[1]).toBe(
      "MasonGallery-2.2.1-1.x86_64.rpm",
    );
    const all = artifactEntries(config, "2.2.1", {
      windows: "all",
      linux: "all",
    });
    expect(all.some(([target]) => target === "windows-x86_64-msi")).toBe(true);
    expect(() =>
      artifactEntries(config, "2.2.1", { windows: [], linux: "all" }),
    ).toThrow("No supported");
  });
  test("resolves draft releases through their numeric ID when get-by-tag is unavailable", () => {
    const draft = { ...manifestFixture().release, draft: true };
    const request = (args) => {
      if (args[0] === "release") return "123\n";
      if (args[1].endsWith("/releases/123")) return JSON.stringify(draft);
      throw new Error("GitHub get-by-tag does not expose drafts");
    };
    expect(getRelease("v2.2.0", request).draft).toBe(true);
    expect(() => getRelease("v2.2.0", () => "invalid-id")).toThrow(
      "Invalid GitHub release ID",
    );
  });
  test("accepts a complete manifest", () => {
    const { release, manifest } = manifestFixture();
    expect(validateManifest(manifest, release)).toHaveLength(
      requiredTargets.length,
    );
  });

  test("rejects partial platform coverage, missing signatures and a wrong version", () => {
    const { release, manifest } = manifestFixture();
    delete manifest.platforms["darwin-aarch64"];
    expect(() => validateManifest(manifest, release)).toThrow(
      "Missing updater platform",
    );
    const complete = manifestFixture().manifest;
    complete.platforms["linux-x86_64"].signature = "";
    expect(() => validateManifest(complete, release)).toThrow(
      "Incomplete updater platform",
    );
    expect(() =>
      validateManifest({ ...manifest, version: "2.1.0" }, release),
    ).toThrow("version");
  });

  test("rejects download URLs outside the selected release", () => {
    const { release, manifest } = manifestFixture();
    manifest.platforms["windows-x86_64"].url =
      "https://example.com/other-installer.exe";
    expect(() => validateManifest(manifest, release)).toThrow(
      "not a release asset",
    );
  });

  test("requires stable tagged URLs for draft assets before publication", () => {
    const { release, manifest } = manifestFixture();
    const taggedUrl = release.assets[0].browser_download_url;
    release.assets[0].browser_download_url = taggedUrl.replace(
      "/download/v2.2.0/",
      "/download/untagged-test/",
    );
    expect(validateManifest(manifest, release)).toHaveLength(
      requiredTargets.length,
    );
    manifest.platforms["windows-x86_64"].url =
      release.assets[0].browser_download_url;
    expect(() => validateManifest(manifest, release)).toThrow(
      "not a release asset",
    );
  });
});
