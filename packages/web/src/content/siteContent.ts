import type { SupportedLanguage } from "@mason-gallery/i18n";

export const SITE_ORIGIN = "https://mason-gallery.rezics.com";
export const GITHUB_URL = "https://github.com/Edge-coordinates/mason-gallery";

export const publicLocales = ["en", "zh-hans", "zh-hant", "ja"] as const;

type Feature = {
  title: string;
  description: string;
};

type Faq = {
  question: string;
  answer: string;
};

export type SiteContent = {
  htmlLang: string;
  ogLocale: string;
  languageName: string;
  languageMenuLabel: string;
  skipToContent: string;
  title: string;
  description: string;
  navFeatures: string;
  navPrivacy: string;
  navAbout: string;
  preferences: string;
  launchApp: string;
  eyebrow: string;
  heroTitle: string;
  heroLead: string;
  githubCta: string;
  highlights: string[];
  featuresTitle: string;
  featuresLead: string;
  features: Feature[];
  stepsTitle: string;
  steps: Feature[];
  privacyTitle: string;
  privacyBody: string;
  privacyDetail: string;
  faqTitle: string;
  faqs: Faq[];
  aboutTitle: string;
  aboutLead: string;
  aboutParagraphs: string[];
  backHome: string;
  footer: string;
  notFoundTitle: string;
  notFoundDescription: string;
  goHome: string;
};

export const siteContent: Record<SupportedLanguage, SiteContent> = {
  en: {
    htmlLang: "en",
    ogLocale: "en_US",
    languageName: "English",
    languageMenuLabel: "Language",
    skipToContent: "Skip to content",
    title: "Mason Gallery — Local Masonry Image Viewer",
    description:
      "Browse image folders in a fast masonry grid directly in your browser. Your files stay on your device and are never uploaded.",
    navFeatures: "Features",
    navPrivacy: "Privacy",
    navAbout: "About",
    preferences: "Preferences",
    launchApp: "Open web app",
    eyebrow: "Local-first image browsing",
    heroTitle: "See every image at a glance.",
    heroLead:
      "Open a folder and browse it in a fast, responsive masonry grid. No imports, no accounts, and no uploads.",
    githubCta: "View on GitHub",
    highlights: [
      "Runs in your browser",
      "Files never leave your device",
      "Free and open source",
    ],
    featuresTitle: "Built for folders, not feeds",
    featuresLead:
      "Mason Gallery turns a local folder into a visual workspace without copying your library into another service.",
    features: [
      {
        title: "Private by design",
        description:
          "Images are read through your browser's file access APIs and stay on your device.",
      },
      {
        title: "A fluid masonry grid",
        description:
          "Mixed portrait and landscape images fit naturally into a fast waterfall layout.",
      },
      {
        title: "Folder-aware browsing",
        description:
          "Scan nested folders, filter by subfolder, and open images in a focused viewer.",
      },
      {
        title: "Useful format coverage",
        description:
          "Browse common image formats including JPEG, PNG, GIF, WebP, BMP, and JFIF.",
      },
    ],
    stepsTitle: "From folder to gallery in three steps",
    steps: [
      {
        title: "Choose a folder",
        description:
          "Grant access to one folder with the browser's native picker.",
      },
      {
        title: "Scan locally",
        description:
          "Mason Gallery reads dimensions and builds the grid on your device.",
      },
      {
        title: "Browse freely",
        description:
          "Explore the masonry view, switch folders, and open a full-size preview.",
      },
    ],
    privacyTitle: "Your library is not our dataset",
    privacyBody:
      "The web app does not upload your selected images. Folder access is granted by you and processed locally in the browser.",
    privacyDetail:
      "A Chromium-based browser with File System Access API support is required for folder selection.",
    faqTitle: "Frequently asked questions",
    faqs: [
      {
        question: "Are my images uploaded?",
        answer:
          "No. The web app reads the folder you select and creates local object URLs in your browser. Your image files are not sent to Mason Gallery.",
      },
      {
        question: "Which browsers are supported?",
        answer:
          "The folder picker relies on the File System Access API, so a current Chromium-based browser is recommended.",
      },
      {
        question: "Is Mason Gallery free?",
        answer:
          "Yes. Mason Gallery is free and open source, with web, desktop, and CLI editions built from the same project.",
      },
      {
        question: "Can it browse nested folders?",
        answer:
          "Yes. The web app scans supported images in nested folders and lets you narrow the grid by subfolder.",
      },
    ],
    aboutTitle: "A calmer way to browse image folders",
    aboutLead:
      "Mason Gallery is an open-source masonry image viewer for the web and desktop.",
    aboutParagraphs: [
      "It was built for the simple moment when a folder contains too many images for a file manager and importing everything into a library app feels excessive.",
      "The project ships a browser app, native desktop app, and npm CLI from a shared React component library. The web edition keeps selected files local to the browser.",
    ],
    backHome: "Back to home",
    footer: "Local-first image browsing, built in the open.",
    notFoundTitle: "Page not found",
    notFoundDescription:
      "The page you requested does not exist or may have moved.",
    goHome: "Go to home",
  },
  "zh-hans": {
    htmlLang: "zh-Hans",
    ogLocale: "zh_CN",
    languageName: "简体中文",
    languageMenuLabel: "语言",
    skipToContent: "跳到主要内容",
    title: "Mason Gallery — 本地瀑布流图片查看器",
    description:
      "直接在浏览器中打开本地文件夹，以快速瀑布流浏览图片。文件保留在你的设备上，不会上传。",
    navFeatures: "功能",
    navPrivacy: "隐私",
    navAbout: "关于",
    preferences: "偏好设置",
    launchApp: "打开网页版",
    eyebrow: "本地优先的图片浏览",
    heroTitle: "一眼看遍文件夹里的图片。",
    heroLead:
      "打开一个文件夹，即刻用流畅的瀑布流浏览图片。无需导入、无需账号，也无需上传。",
    githubCta: "在 GitHub 上查看",
    highlights: ["直接在浏览器运行", "文件不会离开设备", "免费且开源"],
    featuresTitle: "为本地文件夹而生",
    featuresLead:
      "Mason Gallery 将本地文件夹变成直观的图片工作区，不会把图库复制到其他服务。",
    features: [
      {
        title: "隐私优先",
        description:
          "通过浏览器文件访问能力读取图片，文件始终保留在你的设备上。",
      },
      {
        title: "流畅瀑布流",
        description: "横图与竖图自然排列，在同一屏幕中更高效地浏览整个图库。",
      },
      {
        title: "按文件夹浏览",
        description: "扫描多级目录、按子文件夹筛选，并在专注查看器中打开大图。",
      },
      {
        title: "覆盖常用格式",
        description:
          "支持浏览 JPEG、PNG、GIF、WebP、BMP 和 JFIF 等常用图片格式。",
      },
    ],
    stepsTitle: "三步把文件夹变成图库",
    steps: [
      {
        title: "选择文件夹",
        description: "使用浏览器原生选择器，只授权你指定的文件夹。",
      },
      {
        title: "本地扫描",
        description: "Mason Gallery 在设备上读取尺寸并构建瀑布流。",
      },
      {
        title: "自由浏览",
        description: "切换子文件夹、浏览瀑布流，并打开全尺寸预览。",
      },
    ],
    privacyTitle: "你的图库，不是我们的数据集",
    privacyBody:
      "网页版不会上传你选择的图片。文件夹访问由你主动授权，所有处理都在浏览器本地完成。",
    privacyDetail:
      "文件夹选择功能需要支持 File System Access API 的 Chromium 内核浏览器。",
    faqTitle: "常见问题",
    faqs: [
      {
        question: "图片会被上传吗？",
        answer:
          "不会。网页版只读取你选择的文件夹，并在浏览器中创建本地对象 URL，图片文件不会发送给 Mason Gallery。",
      },
      {
        question: "支持哪些浏览器？",
        answer:
          "文件夹选择依赖 File System Access API，建议使用最新版本的 Chromium 内核浏览器。",
      },
      {
        question: "Mason Gallery 免费吗？",
        answer:
          "免费。Mason Gallery 是开源项目，并提供网页版、桌面版和 npm CLI。",
      },
      {
        question: "可以浏览多级文件夹吗？",
        answer:
          "可以。网页版会扫描子目录中的受支持图片，并允许按子文件夹筛选瀑布流。",
      },
    ],
    aboutTitle: "更轻松地浏览图片文件夹",
    aboutLead: "Mason Gallery 是一款面向网页与桌面的开源瀑布流图片查看器。",
    aboutParagraphs: [
      "当一个文件夹里的图片多到文件管理器难以浏览，而导入专业图库软件又显得过重时，Mason Gallery 提供了一个简单直接的选择。",
      "项目通过共享 React 组件库提供网页版、原生桌面版和 npm CLI。网页版会将你选择的文件保留在浏览器本地。",
    ],
    backHome: "返回首页",
    footer: "本地优先的图片浏览，开放构建。",
    notFoundTitle: "找不到页面",
    notFoundDescription: "你访问的页面不存在，或者已经移动。",
    goHome: "返回首页",
  },
  "zh-hant": {
    htmlLang: "zh-Hant",
    ogLocale: "zh_TW",
    languageName: "繁體中文",
    languageMenuLabel: "語言",
    skipToContent: "跳到主要內容",
    title: "Mason Gallery — 本機瀑布流圖片檢視器",
    description:
      "直接在瀏覽器開啟本機資料夾，以快速瀑布流瀏覽圖片。檔案留在你的裝置上，不會上傳。",
    navFeatures: "功能",
    navPrivacy: "隱私",
    navAbout: "關於",
    preferences: "偏好設定",
    launchApp: "開啟網頁版",
    eyebrow: "本機優先的圖片瀏覽",
    heroTitle: "一眼看遍資料夾裡的圖片。",
    heroLead:
      "開啟一個資料夾，立即以流暢的瀑布流瀏覽圖片。無須匯入、無須帳號，也無須上傳。",
    githubCta: "在 GitHub 上查看",
    highlights: ["直接在瀏覽器執行", "檔案不會離開裝置", "免費且開源"],
    featuresTitle: "為本機資料夾而生",
    featuresLead:
      "Mason Gallery 將本機資料夾變成直觀的圖片工作區，不會把圖庫複製到其他服務。",
    features: [
      {
        title: "隱私優先",
        description: "透過瀏覽器檔案存取能力讀取圖片，檔案始終留在你的裝置上。",
      },
      {
        title: "流暢瀑布流",
        description:
          "橫向與直向圖片自然排列，在同一畫面中更有效率地瀏覽整個圖庫。",
      },
      {
        title: "依資料夾瀏覽",
        description: "掃描多層目錄、依子資料夾篩選，並在專注檢視器中開啟大圖。",
      },
      {
        title: "涵蓋常用格式",
        description:
          "支援瀏覽 JPEG、PNG、GIF、WebP、BMP 與 JFIF 等常用圖片格式。",
      },
    ],
    stepsTitle: "三步把資料夾變成圖庫",
    steps: [
      {
        title: "選擇資料夾",
        description: "使用瀏覽器原生選擇器，只授權你指定的資料夾。",
      },
      {
        title: "本機掃描",
        description: "Mason Gallery 在裝置上讀取尺寸並建立瀑布流。",
      },
      {
        title: "自由瀏覽",
        description: "切換子資料夾、瀏覽瀑布流，並開啟完整尺寸預覽。",
      },
    ],
    privacyTitle: "你的圖庫，不是我們的資料集",
    privacyBody:
      "網頁版不會上傳你選擇的圖片。資料夾存取由你主動授權，所有處理都在瀏覽器本機完成。",
    privacyDetail:
      "資料夾選擇功能需要支援 File System Access API 的 Chromium 核心瀏覽器。",
    faqTitle: "常見問題",
    faqs: [
      {
        question: "圖片會被上傳嗎？",
        answer:
          "不會。網頁版只讀取你選擇的資料夾，並在瀏覽器建立本機物件 URL，圖片檔案不會傳送給 Mason Gallery。",
      },
      {
        question: "支援哪些瀏覽器？",
        answer:
          "資料夾選擇依賴 File System Access API，建議使用最新版 Chromium 核心瀏覽器。",
      },
      {
        question: "Mason Gallery 免費嗎？",
        answer:
          "免費。Mason Gallery 是開源專案，並提供網頁版、桌面版與 npm CLI。",
      },
      {
        question: "可以瀏覽多層資料夾嗎？",
        answer:
          "可以。網頁版會掃描子目錄中的支援圖片，並允許依子資料夾篩選瀑布流。",
      },
    ],
    aboutTitle: "更輕鬆地瀏覽圖片資料夾",
    aboutLead: "Mason Gallery 是一款面向網頁與桌面的開源瀑布流圖片檢視器。",
    aboutParagraphs: [
      "當一個資料夾裡的圖片多到檔案管理器難以瀏覽，而匯入專業圖庫軟體又顯得過重時，Mason Gallery 提供一個簡單直接的選擇。",
      "專案透過共享 React 元件庫提供網頁版、原生桌面版與 npm CLI。網頁版會將你選擇的檔案留在瀏覽器本機。",
    ],
    backHome: "返回首頁",
    footer: "本機優先的圖片瀏覽，開放建構。",
    notFoundTitle: "找不到頁面",
    notFoundDescription: "你造訪的頁面不存在，或已經移動。",
    goHome: "返回首頁",
  },
  ja: {
    htmlLang: "ja",
    ogLocale: "ja_JP",
    languageName: "日本語",
    languageMenuLabel: "言語",
    skipToContent: "メインコンテンツへ移動",
    title: "Mason Gallery — ローカル Masonry 画像ビューア",
    description:
      "ローカルフォルダーをブラウザで直接開き、高速な Masonry グリッドで閲覧できます。ファイルは端末内に残り、アップロードされません。",
    navFeatures: "機能",
    navPrivacy: "プライバシー",
    navAbout: "概要",
    preferences: "環境設定",
    launchApp: "Web アプリを開く",
    eyebrow: "ローカルファーストの画像閲覧",
    heroTitle: "フォルダー内の画像を、一目で。",
    heroLead:
      "フォルダーを開くだけで、滑らかな Masonry グリッドをすぐに閲覧できます。インポート、アカウント、アップロードは不要です。",
    githubCta: "GitHub で見る",
    highlights: [
      "ブラウザ上で動作",
      "ファイルは端末外へ送信されません",
      "無料・オープンソース",
    ],
    featuresTitle: "フィードではなく、フォルダーのために",
    featuresLead:
      "Mason Gallery はローカルフォルダーを視覚的なワークスペースに変え、ライブラリを別サービスへコピーしません。",
    features: [
      {
        title: "プライバシー重視",
        description:
          "ブラウザのファイルアクセス機能で画像を読み取り、ファイルは端末内に保持します。",
      },
      {
        title: "滑らかな Masonry グリッド",
        description:
          "縦横比の異なる画像を自然に配置し、フォルダー全体を効率よく確認できます。",
      },
      {
        title: "フォルダー単位の閲覧",
        description:
          "サブフォルダーをスキャンして絞り込み、集中できるビューアで画像を開けます。",
      },
      {
        title: "主要形式に対応",
        description:
          "JPEG、PNG、GIF、WebP、BMP、JFIF などの一般的な画像形式を閲覧できます。",
      },
    ],
    stepsTitle: "3 ステップでフォルダーをギャラリーに",
    steps: [
      {
        title: "フォルダーを選択",
        description:
          "ブラウザ標準の選択画面で、指定したフォルダーだけを許可します。",
      },
      {
        title: "端末内でスキャン",
        description:
          "Mason Gallery が端末上で寸法を読み取り、グリッドを作成します。",
      },
      {
        title: "自由に閲覧",
        description:
          "サブフォルダーを切り替え、Masonry 表示とフルサイズプレビューを楽しめます。",
      },
    ],
    privacyTitle: "あなたのライブラリは、私たちのデータセットではありません",
    privacyBody:
      "Web アプリは選択した画像をアップロードしません。フォルダーへのアクセスは利用者が許可し、処理はブラウザ内で行われます。",
    privacyDetail:
      "フォルダー選択には File System Access API 対応の Chromium 系ブラウザが必要です。",
    faqTitle: "よくある質問",
    faqs: [
      {
        question: "画像はアップロードされますか？",
        answer:
          "いいえ。Web アプリは選択したフォルダーを読み、ブラウザ内にローカル URL を作成します。画像ファイルが Mason Gallery に送信されることはありません。",
      },
      {
        question: "対応ブラウザは？",
        answer:
          "フォルダー選択は File System Access API を利用するため、最新の Chromium 系ブラウザを推奨します。",
      },
      {
        question: "Mason Gallery は無料ですか？",
        answer:
          "はい。Mason Gallery は無料のオープンソースで、Web、デスクトップ、npm CLI 版を提供しています。",
      },
      {
        question: "サブフォルダーも閲覧できますか？",
        answer:
          "はい。対応画像をサブフォルダーからスキャンし、フォルダーごとにグリッドを絞り込めます。",
      },
    ],
    aboutTitle: "画像フォルダーを、もっと穏やかに閲覧する",
    aboutLead:
      "Mason Gallery は Web とデスクトップ向けのオープンソース Masonry 画像ビューアです。",
    aboutParagraphs: [
      "ファイルマネージャーでは見づらいほど画像が多く、ライブラリアプリへすべて取り込むほどではない。そんな場面のために作られました。",
      "共有 React コンポーネントライブラリから Web、ネイティブデスクトップ、npm CLI を提供しています。Web 版で選択したファイルはブラウザ内に保持されます。",
    ],
    backHome: "ホームへ戻る",
    footer: "ローカルファーストの画像閲覧を、オープンに開発しています。",
    notFoundTitle: "ページが見つかりません",
    notFoundDescription:
      "指定されたページは存在しないか、移動した可能性があります。",
    goHome: "ホームへ",
  },
};

export function getLocalizedPath(
  locale: SupportedLanguage,
  page: "home" | "about",
): string {
  const suffix = page === "home" ? "" : "about/";
  return locale === "en" ? `/${suffix}` : `/${locale}/${suffix}`;
}
