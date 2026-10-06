import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

test.skipIf(process.platform !== "win32")(
  "legacy publisher upgrades pass the original directory to the uninstaller and preserve chosen destinations",
  () => {
    const nsisDir =
      process.env.NSIS_DIR ?? join(process.env.LOCALAPPDATA, "tauri", "NSIS");
    const compiler = join(nsisDir, "makensis.exe");
    if (!existsSync(compiler))
      throw new Error("NSIS 3.11 is required; set NSIS_DIR to its directory.");
    const directory = resolve(
      mkdtempSync(join(tmpdir(), "mason-nsis-upgrade-")),
    );
    if (!directory.startsWith(`${resolve(tmpdir())}${sep}mason-nsis-upgrade-`))
      throw new Error("Unexpected probe directory");
    const registryScope = `Software\\MasonGalleryInstallerTests\\${basename(directory)}`;
    const hook = join(
      root,
      "packages/desktop/src-tauri/windows/installer-hooks.nsh",
    );
    const exe = join(directory, "upgrade-probe.exe");
    const source = join(directory, "upgrade-probe.nsi");
    const legacy = join(directory, "old install");
    const current = join(directory, "current-install");
    const chosen = join(directory, "chosen-install");
    // All registry entries and files are isolated fixtures. The generated dummy
    // uninstaller refuses any directory except the exact fixture directory.
    writeFileSync(
      source,
      `Unicode true
RequestExecutionLevel user
Name "MasonGallery upgrade probe"
OutFile "${exe}"
!include "MUI2.nsh"
!include "FileFunc.nsh"
!define MASON_INSTALL_REGKEY "${registryScope}\\current"
!define MASON_LEGACY_INSTALL_REGKEY "${registryScope}\\legacy"
!include "${hook}"
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"
Var ProbeMode
Var ProbeNewDirectory
Var ProbeExit
Function .onInit
  \${GetOptions} $CMDLINE "/MODE=" $ProbeMode
  \${If} $ProbeMode == "existing"
    StrCpy $INSTDIR "${current}"
  \${ElseIf} $ProbeMode != "explicit"
    StrCpy $INSTDIR "$LOCALAPPDATA\\MasonGallery"
  \${EndIf}
FunctionEnd
Section
  DeleteRegKey HKCU "${registryScope}"
  CreateDirectory "${legacy}"
  FileOpen $0 "${legacy}\\mason-gallery.exe" w
  FileWrite $0 "temporary fixture"
  FileClose $0
  WriteUninstaller "${legacy}\\uninstall.exe"
  \${If} $ProbeMode == "invalid"
    WriteRegStr HKCU "\${MASON_LEGACY_INSTALL_REGKEY}" "" "$EXEDIR\\missing"
  \${Else}
    WriteRegStr HKCU "\${MASON_LEGACY_INSTALL_REGKEY}" "" "${legacy}"
  \${EndIf}
  \${If} $ProbeMode == "existing"
    WriteRegStr HKCU "\${MASON_INSTALL_REGKEY}" "" "${current}"
  \${EndIf}
  !insertmacro NSIS_HOOK_PREINSTALL
  ReadRegStr $ProbeNewDirectory HKCU "\${MASON_INSTALL_REGKEY}" ""
  StrCpy $ProbeExit "not-run"
  \${If} $ProbeMode == "default"
    ; Same directory argument format as Tauri's maintenance page.
    ExecWait '"${legacy}\\uninstall.exe" /S _?=$ProbeNewDirectory' $ProbeExit
  \${EndIf}
  FileOpen $0 "$EXEDIR\\result-$ProbeMode.txt" w
  FileWriteUTF16LE $0 "$ProbeNewDirectory$\\r$\\n$INSTDIR$\\r$\\n$ProbeExit"
  FileClose $0
  DeleteRegKey HKCU "${registryScope}"
SectionEnd
Section Uninstall
  ; Never allow the fixture uninstaller to remove a file outside its sandbox.
  \${If} $INSTDIR != "${legacy}"
    SetErrorLevel 2
    Quit
  \${EndIf}
  Delete "$INSTDIR\\mason-gallery.exe"
  SetErrorLevel 0
SectionEnd
`,
    );
    try {
      const compiled = spawnSync(compiler, ["/V3", source], {
        encoding: "utf8",
        windowsHide: true,
        timeout: 30_000,
      });
      if (compiled.status !== 0)
        throw new Error(
          `NSIS upgrade probe compilation failed: ${compiled.stdout}\n${compiled.stderr}`,
        );
      for (const mode of [
        "default",
        "existing",
        "explicit",
        "explicit-default",
        "invalid",
      ]) {
        const args = ["/S", `/MODE=${mode}`];
        if (mode === "explicit") args.push(`/D=${chosen}`);
        if (mode === "explicit-default")
          args.push(`/D=${join(process.env.LOCALAPPDATA, "MasonGallery")}`);
        const run = spawnSync(exe, args, {
          windowsHide: true,
          timeout: 15_000,
        });
        expect(run.status).toBe(0);
        const [savedDirectory, destination, uninstallExit] = readFileSync(
          join(directory, `result-${mode}.txt`),
          "utf16le",
        ).split(/\r?\n/);
        if (mode === "default") {
          expect(savedDirectory).toBe(legacy);
          expect(destination).toBe(legacy);
          expect(uninstallExit).toBe("0");
          expect(existsSync(join(legacy, "mason-gallery.exe"))).toBe(false);
        } else if (mode === "existing") {
          expect(savedDirectory).toBe(current);
          expect(destination).toBe(current);
        } else if (mode === "explicit") {
          expect(savedDirectory).toBe(legacy);
          expect(destination).toBe(chosen);
        } else if (mode === "explicit-default") {
          expect(savedDirectory).toBe(legacy);
          expect(destination).toBe(
            join(process.env.LOCALAPPDATA, "MasonGallery"),
          );
        } else {
          expect(savedDirectory).toBe("");
          expect(destination).toBe(
            join(process.env.LOCALAPPDATA, "MasonGallery"),
          );
        }
      }
    } finally {
      const registryTarget = `HKCU\\${registryScope}`;
      // Scope was constructed only from the validated mkdtemp leaf above.
      spawnSync("reg.exe", ["delete", registryTarget, "/f"], {
        windowsHide: true,
        stdio: "ignore",
      });
      rmSync(directory, { recursive: true, force: true });
    }
  },
  90_000,
);
