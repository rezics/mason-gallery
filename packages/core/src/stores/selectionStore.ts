import { create } from "zustand";
import { getPlatform } from "@/context/PlatformContext";
import { identityAfterMove } from "@/lib/selectionIdentity";
import { parseSelectionState } from "@/persistence/selectionSchema";
import type { SelectableFileIdentity } from "@/types";
import type {
  MoveItemResult,
  PersistedSelectionEntry,
  PersistedSelectionState,
  SelectionEntryKey,
} from "@/types/platform";

export type SelectionStatus = "unhydrated" | "ready";

interface SelectionSnapshot {
  modeEnabled: boolean;
  entries: PersistedSelectionEntry[];
}

interface SelectionState {
  status: SelectionStatus;
  modeEnabled: boolean;
  entries: Map<string, PersistedSelectionEntry>;
  persistError: string | null;

  hydrate: () => Promise<void>;
  setModeEnabled: (enabled: boolean) => void;
  toggle: (entry: SelectableFileIdentity) => void;
  selectMany: (entries: SelectableFileIdentity[]) => void;
  clearPackage: (packageKey: string) => void;
  clearAll: () => void;
  removeByEntryKeys: (entryKeys: string[]) => void;
  markSeen: (entries: SelectableFileIdentity[], seenAt?: string) => void;
  applyMoveResults: (
    results: MoveItemResult[],
    knownRoots: Array<{ path: string; packageKey?: string }>,
  ) => void;
}

let hydrationPromise: Promise<void> | null = null;
let persistChain: Promise<void> = Promise.resolve();
let persistQueued = false;
let persisting = false;
let lastAcked: SelectionSnapshot = {
  modeEnabled: false,
  entries: [],
};

function nowIso(): string {
  return new Date().toISOString();
}

function cloneEntries(
  entries: Map<string, PersistedSelectionEntry>,
): Map<string, PersistedSelectionEntry> {
  return new Map(
    [...entries.entries()].map(([key, entry]) => [key, { ...entry }]),
  );
}

function snapshotFromState(
  modeEnabled: boolean,
  entries: Map<string, PersistedSelectionEntry>,
): SelectionSnapshot {
  return {
    modeEnabled,
    entries: [...entries.values()].map((entry) => ({ ...entry })),
  };
}

function mapFromEntries(
  entries: PersistedSelectionEntry[],
): Map<string, PersistedSelectionEntry> {
  const map = new Map<string, PersistedSelectionEntry>();
  for (const entry of entries) {
    map.set(entry.entryKey, { ...entry });
  }
  return map;
}

function sameEntry(
  a: PersistedSelectionEntry,
  b: PersistedSelectionEntry,
): boolean {
  return (
    a.packageKey === b.packageKey &&
    a.entryKey === b.entryKey &&
    a.locator === b.locator &&
    a.relativePath === b.relativePath &&
    a.selectedAt === b.selectedAt &&
    a.lastSeenAt === b.lastSeenAt
  );
}

function restoreSnapshot(snapshot: SelectionSnapshot): void {
  useSelectionStore.setState({
    modeEnabled: snapshot.modeEnabled,
    entries: mapFromEntries(snapshot.entries),
  });
}

function applyState(parsed: PersistedSelectionState): void {
  const entries = mapFromEntries(parsed.entries);
  lastAcked = snapshotFromState(parsed.modeEnabled, entries);
  useSelectionStore.setState({
    status: "ready",
    modeEnabled: parsed.modeEnabled,
    entries,
    persistError: null,
  });
}

function diffEntries(
  previous: PersistedSelectionEntry[],
  next: PersistedSelectionEntry[],
): { upsert: PersistedSelectionEntry[]; remove: SelectionEntryKey[] } {
  const prevByKey = new Map(previous.map((entry) => [entry.entryKey, entry]));
  const nextByKey = new Map(next.map((entry) => [entry.entryKey, entry]));
  const upsert: PersistedSelectionEntry[] = [];
  const remove: SelectionEntryKey[] = [];

  for (const entry of next) {
    const prior = prevByKey.get(entry.entryKey);
    if (
      !prior ||
      !sameEntry(prior, entry) ||
      prior.packageKey !== entry.packageKey
    ) {
      upsert.push(entry);
    }
  }
  for (const entry of previous) {
    if (!nextByKey.has(entry.entryKey)) {
      remove.push({ packageKey: entry.packageKey, entryKey: entry.entryKey });
    }
  }
  return { upsert, remove };
}

async function persistSnapshot(intended: SelectionSnapshot): Promise<void> {
  const platform = getPlatform();
  if (!platform.capabilities.canBatchMoveFiles) {
    throw new Error("Selection persistence is not available on this platform");
  }
  if (!platform.commitSelectionMutation) {
    throw new Error("Selection storage methods are missing");
  }

  const { upsert, remove } = diffEntries(lastAcked.entries, intended.entries);
  const modeChanged = intended.modeEnabled !== lastAcked.modeEnabled;
  if (!modeChanged && upsert.length === 0 && remove.length === 0) {
    return;
  }
  await platform.commitSelectionMutation({
    modeEnabled: modeChanged ? intended.modeEnabled : undefined,
    upsert,
    remove,
  });
}

function schedulePersist(): void {
  const state = useSelectionStore.getState();
  if (state.status !== "ready") return;
  persistQueued = true;
  if (persisting) return;

  persisting = true;
  persistQueued = false;
  const intended = snapshotFromState(state.modeEnabled, state.entries);

  persistChain = persistChain
    .catch(() => undefined)
    .then(async () => {
      try {
        await persistSnapshot(intended);
        lastAcked = intended;
        const latest = useSelectionStore.getState();
        if (latest.persistError) {
          useSelectionStore.setState({ persistError: null });
        }
      } catch (error) {
        restoreSnapshot(lastAcked);
        useSelectionStore.setState({
          persistError:
            error instanceof Error
              ? error.message
              : "Could not save the selection",
        });
        persistQueued = false;
      } finally {
        persisting = false;
        const latest = useSelectionStore.getState();
        const drifted =
          persistQueued ||
          latest.modeEnabled !== lastAcked.modeEnabled ||
          diffEntries(
            lastAcked.entries,
            snapshotFromState(latest.modeEnabled, latest.entries).entries,
          ).upsert.length > 0 ||
          diffEntries(
            lastAcked.entries,
            snapshotFromState(latest.modeEnabled, latest.entries).entries,
          ).remove.length > 0;
        if (latest.status === "ready" && drifted) {
          schedulePersist();
        }
      }
    });
}

function mutateIfReady(
  recipe: (state: {
    modeEnabled: boolean;
    entries: Map<string, PersistedSelectionEntry>;
  }) => {
    modeEnabled: boolean;
    entries: Map<string, PersistedSelectionEntry>;
  },
): void {
  const state = useSelectionStore.getState();
  if (state.status !== "ready") return;
  const next = recipe({
    modeEnabled: state.modeEnabled,
    entries: cloneEntries(state.entries),
  });
  useSelectionStore.setState({
    modeEnabled: next.modeEnabled,
    entries: next.entries,
  });
  schedulePersist();
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  status: "unhydrated",
  modeEnabled: false,
  entries: new Map(),
  persistError: null,

  hydrate: async () => {
    if (get().status === "ready") return;
    if (hydrationPromise) return hydrationPromise;

    hydrationPromise = (async () => {
      const platform = getPlatform();
      if (!platform.capabilities.canBatchMoveFiles) {
        return;
      }
      if (!platform.loadSelectionState) {
        set({
          persistError: "Selection storage methods are missing",
        });
        return;
      }
      try {
        const parsed = parseSelectionState(await platform.loadSelectionState());
        applyState(parsed);
      } catch (error) {
        console.error("Failed to hydrate selection state:", error);
        set({
          persistError:
            error instanceof Error
              ? error.message
              : "Could not load the selection",
        });
      }
    })();

    try {
      await hydrationPromise;
    } finally {
      hydrationPromise = null;
    }
  },

  setModeEnabled: (enabled) => {
    mutateIfReady((state) => ({ ...state, modeEnabled: enabled }));
  },

  toggle: (entry) => {
    mutateIfReady((state) => {
      const entries = state.entries;
      if (entries.has(entry.entryKey)) {
        entries.delete(entry.entryKey);
      } else {
        entries.set(entry.entryKey, {
          ...entry,
          selectedAt: nowIso(),
          lastSeenAt: nowIso(),
        });
      }
      return { ...state, entries };
    });
  },

  selectMany: (identities) => {
    if (identities.length === 0) return;
    mutateIfReady((state) => {
      const entries = state.entries;
      const selectedAt = nowIso();
      for (const identity of identities) {
        const existing = entries.get(identity.entryKey);
        entries.set(identity.entryKey, {
          ...identity,
          selectedAt: existing?.selectedAt ?? selectedAt,
          lastSeenAt: selectedAt,
        });
      }
      return { ...state, entries };
    });
  },

  clearPackage: (packageKey) => {
    mutateIfReady((state) => {
      const entries = state.entries;
      for (const [key, entry] of entries) {
        if (entry.packageKey === packageKey) entries.delete(key);
      }
      return { ...state, entries };
    });
  },

  clearAll: () => {
    mutateIfReady((state) => ({
      ...state,
      entries: new Map(),
    }));
  },

  removeByEntryKeys: (entryKeys) => {
    if (entryKeys.length === 0) return;
    const drop = new Set(entryKeys);
    mutateIfReady((state) => {
      const entries = state.entries;
      let changed = false;
      for (const key of drop) {
        if (entries.delete(key)) changed = true;
      }
      if (!changed) return state;
      return { ...state, entries };
    });
  },

  markSeen: (identities, seenAt = nowIso()) => {
    if (identities.length === 0) return;
    mutateIfReady((state) => {
      const entries = state.entries;
      let changed = false;
      for (const identity of identities) {
        const existing = entries.get(identity.entryKey);
        if (!existing) continue;
        entries.set(identity.entryKey, {
          ...existing,
          locator: identity.locator,
          relativePath: identity.relativePath,
          packageKey: identity.packageKey,
          lastSeenAt: seenAt,
        });
        changed = true;
      }
      if (!changed) {
        return state;
      }
      return { ...state, entries };
    });
  },

  // TODO: Live moves drop relocated keys instead of calling this. Restore
  // selection onto destination identities once remapping is reliable.
  applyMoveResults: (results, knownRoots) => {
    const moved = results.filter(
      (result): result is Extract<MoveItemResult, { status: "moved" }> =>
        result.status === "moved",
    );
    if (moved.length === 0) return;
    mutateIfReady((state) => {
      const entries = state.entries;
      const roots = knownRoots.map((root) => ({
        path: root.path,
        packageKey: root.packageKey ?? "",
      }));
      for (const result of moved) {
        const previous = entries.get(result.entryKey);
        if (!previous) continue;
        entries.delete(result.entryKey);
        const nextIdentity = identityAfterMove(result.destinationPath, roots);
        entries.set(nextIdentity.entryKey, {
          ...nextIdentity,
          selectedAt: previous.selectedAt,
          lastSeenAt: nowIso(),
        });
      }
      return { ...state, entries };
    });
  },
}));

export async function flushSelectionPersist(): Promise<void> {
  let turns = 0;
  while (persisting || persistQueued) {
    await persistChain;
    turns += 1;
    if (turns > 50) break;
  }
  await persistChain;
}

export function resetSelectionStore(): void {
  hydrationPromise = null;
  persistChain = Promise.resolve();
  persistQueued = false;
  persisting = false;
  lastAcked = { modeEnabled: false, entries: [] };
  useSelectionStore.setState({
    status: "unhydrated",
    modeEnabled: false,
    entries: new Map(),
    persistError: null,
  });
}
