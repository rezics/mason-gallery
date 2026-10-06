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
const locales = {
  English: {
    id: 1033,
    title: "System integration",
    folder: "Add 'Open with MasonGallery' for folders",
  },
  SimpChinese: {
    id: 2052,
    title: "系统集成",
    folder: "为文件夹添加“使用 MasonGallery 打开”",
  },
  TradChinese: {
    id: 1028,
    title: "系統整合",
    folder: "為資料夾加入「使用 MasonGallery 開啟」",
  },
  Japanese: {
    id: 1041,
    title: "システム連携",
    folder: "フォルダーに「MasonGallery で開く」を追加",
  },
};

test.skipIf(process.platform !== "win32")(
  "installer hooks follow the selected language when included before Tauri's language tables",
  () => {
    const nsisDir =
      process.env.NSIS_DIR ?? join(process.env.LOCALAPPDATA, "tauri", "NSIS");
    const compiler = join(nsisDir, "makensis.exe");
    if (!existsSync(compiler))
      throw new Error("NSIS 3.11 is required; set NSIS_DIR to its directory.");
    const directory = mkdtempSync(join(tmpdir(), "mason-nsis-language-"));
    const cleanupTarget = resolve(directory);
    if (
      !cleanupTarget.startsWith(
        `${resolve(tmpdir())}${sep}mason-nsis-language-`,
      )
    ) {
      throw new Error("Unexpected probe directory");
    }
    const hook = join(
      root,
      "packages/desktop/src-tauri/windows/installer-hooks.nsh",
    );
    const registryScope = `Software\\MasonGalleryInstallerTests\\${basename(directory)}`;
    const config = JSON.parse(
      readFileSync(
        join(root, "packages/desktop/src-tauri/tauri.windows.conf.json"),
        "utf8",
      ),
    );
    const languages = config.bundle.windows.nsis.languages;
    for (const language of languages) expect(locales[language]).toBeDefined();
    const exe = join(directory, "language-probe.exe");
    const source = join(directory, "language-probe.nsi");
    // Tauri CLI 2.10.1 includes installer hooks before MUI_LANGUAGE. The silent
    // probe renders strings in a section, after .onInit initializes $LANGUAGE.
    // It only writes probe output; it never installs files or changes registry data.
    writeFileSync(
      source,
      `Unicode true
RequestExecutionLevel user
Name "MasonGallery language probe"
OutFile "${exe}"
!include "MUI2.nsh"
!include "FileFunc.nsh"
!define MASON_INSTALL_REGKEY "${registryScope}\\current"
!define MASON_LEGACY_INSTALL_REGKEY "${registryScope}\\legacy"
!include "${hook}"
!insertmacro MUI_PAGE_INSTFILES
${languages.map((language) => `!insertmacro MUI_LANGUAGE "${language}"`).join("\n")}
Function .onInit
  \${GetOptions} $CMDLINE "/LANGID=" $LANGUAGE
FunctionEnd
Section
  FileOpen $0 "$EXEDIR\\language-$LANGUAGE.txt" w
  FileWriteUTF16LE $0 "$LANGUAGE$\\r$\\n$(ShellIntegrationTitle)$\\r$\\n$(ShellIntegrationFolders)$\\r$\\n$(^NextBtn)$\\r$\\n$(^CancelBtn)"
  FileClose $0
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
          `NSIS probe compilation failed: ${compiled.stdout}\n${compiled.stderr}`,
        );
      for (const language of languages) {
        const locale = locales[language];
        const run = spawnSync(exe, ["/S", `/LANGID=${locale.id}`], {
          windowsHide: true,
          timeout: 15_000,
        });
        expect(run.status).toBe(0);
        const [id, title, folder, next, cancel] = readFileSync(
          join(directory, `language-${locale.id}.txt`),
          "utf16le",
        )
          .replace(/^\uFEFF/, "")
          .split(/\r?\n/);
        expect(id).toBe(String(locale.id));
        expect(title).toBe(locale.title);
        expect(folder).toBe(locale.folder);
        if (language === "English") {
          expect(next.replaceAll("&", "")).toContain("Next");
          expect(cancel.replaceAll("&", "")).toBe("Cancel");
        }
      }
    } finally {
      rmSync(cleanupTarget, { recursive: true, force: true });
    }
  },
  90_000,
);
