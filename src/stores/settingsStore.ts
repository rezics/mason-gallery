import { load } from "@tauri-apps/plugin-store";
import { create } from "zustand";
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

const STORE_FILE = "settings.json";

const DEFAULTS = {
  formats: [".webp", ".jxl", ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".jfif"],
  sortMethod: "name-asc" as SortMethod,
  pageSize: 50,
  language: "en" as Locale,
  breakpoints: { 500: 2, 800: 3, 1200: 4, 1400: 5 } as ColumnBreakpoints,
};

async function persist(key: string, value: unknown) {
  try {
    const store = await load(STORE_FILE, { defaults: {}, autoSave: true });
    await store.set(key, value);
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
      const store = await load(STORE_FILE, { defaults: {}, autoSave: true });
      const formats = await store.get<string[]>("formats");
      const sortMethod = await store.get<SortMethod>("sortMethod");
      const pageSize = await store.get<number>("pageSize");
      const language = await store.get<Locale>("language");
      const breakpoints = await store.get<ColumnBreakpoints>("breakpoints");

      set({
        formats: formats ?? DEFAULTS.formats,
        sortMethod: sortMethod ?? DEFAULTS.sortMethod,
        pageSize: pageSize ?? DEFAULTS.pageSize,
        language: language ?? DEFAULTS.language,
        breakpoints: breakpoints ?? DEFAULTS.breakpoints,
        _hydrated: true,
      });
    } catch (e) {
      console.error("Failed to hydrate settings:", e);
      set({ _hydrated: true });
    }
  },
}));
