export type Locales = "en" | "zh";

export type TranslationKeys = {
  appName: string;
  menu: {
    file: string;
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
    imageCount: string;
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
  };
  viewer: {
    deleteConfirm: string;
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
};

export type Translations = Record<Locales, TranslationKeys>;
