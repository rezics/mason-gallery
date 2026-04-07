export type Locales = "en" | "zh";

export type TranslationKeys = {
  appName: string;
  menu: {
    file: string;
    openFolder: string;
    reset: string;
    quit: string;
    view: string;
    refresh: string;
    window: string;
    devTools: string;
    help: string;
    about: string;
  };
  home: {
    dropZoneTitle: string;
    dropZoneHint: string;
    selectFolder: string;
    scanning: string;
    scanProgress: string;
    imageCount: string;
    goToImage: string;
  };
  settings: {
    title: string;
    formats: string;
    formatsHint: string;
    addFormat: string;
    sortMethod: string;
    nameAsc: string;
    nameDesc: string;
    timeAsc: string;
    timeDesc: string;
    pageSize: string;
    language: string;
    columns: string;
    showGridPosition: string;
    confirmDelete: string;
    showDeleteToast: string;
  };
  viewer: {
    deleteConfirm: string;
    deleteSuccess: string;
    info: string;
    revealInFolder: string;
    fileName: string;
    dimensions: string;
    filePath: string;
  };
  about: {
    title: string;
    version: string;
    description: string;
    github: string;
  };
  actions: {
    refresh: string;
    settings: string;
    close: string;
  };
  sidebar: {
    folders: string;
    showAll: string;
    noSubfolders: string;
  };
  update: {
    available: string;
    installing: string;
    install: string;
    dismiss: string;
    error: string;
  };
};

export type Translations = Record<Locales, TranslationKeys>;
