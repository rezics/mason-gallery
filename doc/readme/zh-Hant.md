# Mason Gallery

![banner](../../public/logo/banner.svg)

瀑布流佈局桌面圖片瀏覽器

## 功能特色

- 瀑布流（Masonry）佈局瀏覽圖片，支援虛擬捲動
- 全螢幕圖片檢視器，支援鍵盤導覽
- 自訂圖片格式篩選
- 多種排序方式（名稱、時間）
- 自適應欄位斷點設定
- 拖放資料夾快速開啟
- 圖片移至資源回收筒
- 多語系支援（English / 中文）
- 自動更新

## 開發

### 環境需求

- [Bun](https://bun.sh/)
- [Go Task](https://taskfile.dev/installation/)
- [Rust](https://www.rust-lang.org/tools/install)
- [Tauri 環境需求](https://v2.tauri.app/start/prerequisites/)

```bash
bun install
task dev:desktop
```

### 更新簽章金鑰設定

自動更新功能需要簽章金鑰對，使用以下指令產生：

```bash
bunx @tauri-apps/cli signer generate -w ~/.tauri/mason-gallery.key
```

這會建立：
- **私鑰**：`~/.tauri/mason-gallery.key`（請妥善保管）
- **公鑰**：輸出至終端

**設定專案：**

1. 將公鑰複製到 `src-tauri/tauri.conf.json` 的 `plugins.updater.pubkey` 欄位
2. 在 GitHub 儲存庫新增以下 Secrets 供發佈工作流程使用：
   - `TAURI_SIGNING_PRIVATE_KEY` — 私鑰檔案內容
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — 產生金鑰時設定的密碼（若有）
