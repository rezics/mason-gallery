import { create } from "zustand";
import { getPlatform } from "@/context/PlatformContext";
import { useSettingsStore } from "@/stores/settingsStore";
import type {
  GallerySourceShortcut,
  LibrarySource,
  LibrarySourceInput,
  LibrarySourcePatch,
} from "@/types/platform";

interface LibraryState {
  sources: LibrarySource[];
  isLoading: boolean;
  error: string | null;
  _hydrated: boolean;
  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  addSources: (sources: LibrarySourceInput[]) => Promise<LibrarySource[]>;
  updateSource: (
    id: number,
    patch: LibrarySourcePatch,
  ) => Promise<LibrarySource[]>;
  removeSources: (ids: number[]) => Promise<LibrarySource[]>;
}

let hydrationPromise: Promise<void> | null = null;

function mergeLegacyShortcuts(
  recent: GallerySourceShortcut[],
  favorites: GallerySourceShortcut[],
): LibrarySourceInput[] {
  const bySource = new Map<string, LibrarySourceInput>();

  for (const source of [...recent, ...favorites]) {
    const key = `${source.kind}:${source.path.toLocaleLowerCase()}`;
    const existing = bySource.get(key);
    bySource.set(key, {
      kind: source.kind,
      path: source.path,
      label: source.label,
      lastOpenedAt:
        existing?.lastOpenedAt && existing.lastOpenedAt > source.lastOpenedAt
          ? existing.lastOpenedAt
          : source.lastOpenedAt,
    });
  }

  return [...bySource.values()];
}

async function loadSourcesWithLegacyMigration(): Promise<LibrarySource[]> {
  const platform = getPlatform();
  if (!platform.listLibrarySources) return [];

  const sources = await platform.listLibrarySources();
  if (sources.length > 0 || !platform.addLibrarySources) return sources;

  const settings = useSettingsStore.getState();
  const legacy = mergeLegacyShortcuts(
    settings.recentSources,
    settings.favoriteSources,
  );
  if (legacy.length === 0) return sources;

  let migrated = await platform.addLibrarySources(legacy);
  if (!platform.updateLibrarySource) return migrated;

  const favoriteKeys = new Set(
    settings.favoriteSources.map(
      (source) => `${source.kind}:${source.path.toLocaleLowerCase()}`,
    ),
  );
  for (const source of migrated) {
    const key = `${source.kind}:${source.path.toLocaleLowerCase()}`;
    if (favoriteKeys.has(key) && !source.isFavorite) {
      migrated = await platform.updateLibrarySource(source.id, {
        isFavorite: true,
      });
    }
  }
  return migrated;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  sources: [],
  isLoading: false,
  error: null,
  _hydrated: false,

  hydrate: async () => {
    if (get()._hydrated) return;
    if (hydrationPromise) return hydrationPromise;

    hydrationPromise = (async () => {
      set({ isLoading: true, error: null });
      try {
        set({
          sources: await loadSourcesWithLegacyMigration(),
          _hydrated: true,
        });
      } catch (error) {
        console.error("Failed to hydrate gallery library:", error);
        set({ error: String(error), _hydrated: true });
      } finally {
        set({ isLoading: false });
      }
    })();

    try {
      await hydrationPromise;
    } finally {
      hydrationPromise = null;
    }
  },

  refresh: async () => {
    const platform = getPlatform();
    if (!platform.listLibrarySources) return;
    set({ isLoading: true, error: null });
    try {
      set({ sources: await platform.listLibrarySources() });
    } catch (error) {
      set({ error: String(error) });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  addSources: async (sources) => {
    const platform = getPlatform();
    if (!platform.addLibrarySources || sources.length === 0) {
      return get().sources;
    }
    try {
      const next = await platform.addLibrarySources(sources);
      set({ sources: next, error: null, _hydrated: true });
      return next;
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  updateSource: async (id, patch) => {
    const platform = getPlatform();
    if (!platform.updateLibrarySource) return get().sources;
    try {
      const next = await platform.updateLibrarySource(id, patch);
      set({ sources: next, error: null });
      return next;
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  removeSources: async (ids) => {
    const platform = getPlatform();
    if (!platform.removeLibrarySources || ids.length === 0) {
      return get().sources;
    }
    try {
      const next = await platform.removeLibrarySources(ids);
      set({ sources: next, error: null });
      return next;
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },
}));
