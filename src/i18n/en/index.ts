import type { TranslationKeys } from "../i18n-types";

const en: TranslationKeys = {
  appName: "MasonGallery",
  menu: {
    file: "File",
    openFolder: "Open Folder",
    reset: "New Window",
    quit: "Quit",
    view: "View",
    refresh: "Refresh",
    window: "Window",
    devTools: "Dev Tools",
    help: "Help",
    about: "About",
  },
  home: {
    dropZoneTitle: "Drop folders here",
    dropZoneHint: "or click to select folders",
    selectFolder: "Select Folder",
    scanning: "Scanning...",
    imageCount: "{count} images",
  },
  settings: {
    title: "Settings",
    formats: "Image Formats",
    formatsHint: "File extensions to include",
    addFormat: "Add format",
    sortMethod: "Sort Method",
    nameAsc: "Name (A→Z)",
    nameDesc: "Name (Z→A)",
    timeAsc: "Time (Oldest)",
    timeDesc: "Time (Newest)",
    pageSize: "Images per batch",
    language: "Language",
    columns: "Column Breakpoints",
  },
  viewer: {
    deleteConfirm: "Move this image to trash?",
  },
  about: {
    title: "About MasonGallery",
    version: "Version",
    description: "A desktop image viewer with masonry layout",
    github: "View on GitHub",
  },
  actions: {
    refresh: "Refresh",
    settings: "Settings",
    close: "Close",
  },
  update: {
    available: "A new version is available!",
    installing: "Installing update...",
    install: "Install & Restart",
    dismiss: "Later",
    error: "Update failed",
  },
};

export default en;
