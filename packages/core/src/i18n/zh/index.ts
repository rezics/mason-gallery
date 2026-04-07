import type { TranslationKeys } from "../i18n-types";

const zh: TranslationKeys = {
  appName: "MasonGallery",
  menu: {
    file: "文件",
    openFolder: "打开文件夹",
    reset: "新窗口",
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
    scanProgress: "{loaded} / {total} 张图片",
    imageCount: "{count} 张图片",
    goToImage: "跳转到图片 (Ctrl+G)",
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
    showGridPosition: "显示网格位置",
  },
  viewer: {
    deleteConfirm: "将此图片移至回收站？",
  },
  about: {
    title: "关于 MasonGallery",
    version: "版本",
    description: "瀑布流布局桌面图片查看器",
    github: "在 GitHub 上查看",
  },
  actions: {
    refresh: "刷新",
    settings: "设置",
    close: "关闭",
  },
  sidebar: {
    folders: "文件夹",
    showAll: "显示全部",
    noSubfolders: "没有子文件夹",
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
