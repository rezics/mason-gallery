import type { TranslationKeys } from "../i18n-types";

const zh: TranslationKeys = {
  appName: "WViewer",
  menu: {
    file: "文件",
    quit: "退出",
    view: "视图",
    refresh: "刷新",
    window: "窗口",
    devTools: "开发者工具",
    help: "帮助",
    about: "关于",
  },
  home: {
    dropZoneTitle: "将文件夹拖放到此处",
    dropZoneHint: "或点击选择文件夹",
    selectFolder: "选择文件夹",
    scanning: "扫描中...",
    imageCount: "{count} 张图片",
  },
  settings: {
    title: "设置",
    formats: "图片格式",
    formatsHint: "包含的文件扩展名",
    addFormat: "添加格式",
    sortMethod: "排序方式",
    nameAsc: "名称 (A→Z)",
    nameDesc: "名称 (Z→A)",
    timeAsc: "时间 (最旧)",
    timeDesc: "时间 (最新)",
    pageSize: "每批图片数",
    language: "语言",
    columns: "列断点",
  },
  viewer: {
    deleteConfirm: "将此图片移至回收站？",
  },
  about: {
    title: "关于 WViewer",
    version: "版本",
    description: "瀑布流布局桌面图片查看器",
    github: "在 GitHub 上查看",
  },
  actions: {
    refresh: "刷新",
    settings: "设置",
    close: "关闭",
  },
  update: {
    available: "发现新版本！",
    installing: "正在安装更新...",
    install: "安装并重启",
    dismiss: "稍后",
    error: "更新失败",
  },
};

export default zh;
