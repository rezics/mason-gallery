import { create } from "zustand";
import { getPlatform } from "@/context/PlatformContext";
import type { ColumnBreakpoints, Locale, SortMethod } from "@/types";

interface SettingsState {
  formats: string[];
  sortMethod: SortMethod;
  pageSize: number;
  language: Locale;
  breakpoints: ColumnBreakpoints;
  _hydrated: boolean;

  setFormats: (formats: string[]) => void;
  setSortMethod: (method: SortMethod) => void;
  setPageSize: (size: number) => void;
  setLanguage: (lang: Locale) => void;
  setBreakpoints: (bp: ColumnBreakpoints) => void;
  hydrate: () => Promise<void>;
}

const DEFAULTS = {
  formats: [".webp", ".jxl", ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".jfif"],
  sortMethod: "name-asc" as SortMethod,
  pageSize: 50,
  language: "en" as Locale,
  breakpoints: { 500: 2, 800: 3, 1200: 4, 1400: 5 } as ColumnBreakpoints,
};

async function persist(key: string, value: unknown) {
  try {
    const platform = getPlatform();
    await platform.saveSettings(key, value);
  } catch (e) {
    console.error("Failed to persist setting:", key, e);
  }
}

export const useSettingsStore = create<SettingsState>((set) => ({
  ...DEFAULTS,
  _hydrated: false,

  setFormats: (formats) => {
    set({ formats });
    persist("formats", formats);
  },
  setSortMethod: (sortMethod) => {
    set({ sortMethod });
    persist("sortMethod", sortMethod);
  },
  setPageSize: (pageSize) => {
    set({ pageSize });
    persist("pageSize", pageSize);
  },
  setLanguage: (language) => {
    set({ language });
    persist("language", language);
  },
  setBreakpoints: (breakpoints) => {
    set({ breakpoints });
    persist("breakpoints", breakpoints);
  },

  hydrate: async () => {
    try {
      const platform = getPlatform();
      const settings = await platform.loadSettings();

      set({
        formats: settings.formats ?? DEFAULTS.formats,
        sortMethod: settings.sortMethod ?? DEFAULTS.sortMethod,
        pageSize: settings.pageSize ?? DEFAULTS.pageSize,
        language: settings.language ?? DEFAULTS.language,
        breakpoints: settings.breakpoints ?? DEFAULTS.breakpoints,
        _hydrated: true,
      });
    } catch (e) {
      console.error("Failed to hydrate settings:", e);
      set({ _hydrated: true });
    }
  },
}));
