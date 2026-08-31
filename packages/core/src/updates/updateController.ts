export type UpdateStatus =
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "installing"
  | "error";

export type UpdateCheckReason = "auto" | "manual";
export type UpdateErrorPhase = "check" | "install";

export interface UpdateSnapshot {
  status: UpdateStatus;
  version: string | null;
  errorPhase: UpdateErrorPhase | null;
  lastCheckReason: UpdateCheckReason | null;
  bannerVisible: boolean;
}

export interface UpdateBackend {
  check: () => Promise<{ version: string } | null>;
  install: () => Promise<void>;
}

export interface UpdateCheckRequest {
  reason: UpdateCheckReason;
  canAutoUpdate: boolean;
  autoCheckEnabled: boolean;
  /** Launch-time auto-check only. Manual checks ignore this. */
  isProductionBuild: boolean;
}

export const IDLE_UPDATE_SNAPSHOT: UpdateSnapshot = {
  status: "idle",
  version: null,
  errorPhase: null,
  lastCheckReason: null,
  bannerVisible: false,
};

export function isUpdateBusy(status: UpdateStatus): boolean {
  return status === "checking" || status === "installing";
}

export function shouldStartUpdateCheck(
  snapshot: UpdateSnapshot,
  request: UpdateCheckRequest,
): boolean {
  if (!request.canAutoUpdate) return false;
  if (request.reason === "auto") {
    if (!request.autoCheckEnabled) return false;
    if (!request.isProductionBuild) return false;
  }
  return !isUpdateBusy(snapshot.status);
}

export function createUpdateController(backend: UpdateBackend | null = null) {
  let snapshot: UpdateSnapshot = { ...IDLE_UPDATE_SNAPSHOT };
  let activeBackend = backend;
  let inFlight: Promise<void> | null = null;
  const listeners = new Set<(next: UpdateSnapshot) => void>();

  const emit = (next: UpdateSnapshot) => {
    snapshot = next;
    for (const listener of listeners) listener(snapshot);
  };

  const subscribe = (listener: (next: UpdateSnapshot) => void) => {
    listeners.add(listener);
    listener(snapshot);
    return () => {
      listeners.delete(listener);
    };
  };

  const check = async (
    request: UpdateCheckRequest,
  ): Promise<UpdateSnapshot> => {
    if (inFlight) return inFlight.then(() => snapshot);
    if (!shouldStartUpdateCheck(snapshot, request) || !activeBackend) {
      return snapshot;
    }

    const currentBackend = activeBackend;
    emit({
      ...snapshot,
      status: "checking",
      errorPhase: null,
      lastCheckReason: request.reason,
      bannerVisible: false,
    });

    inFlight = (async () => {
      try {
        const update = await currentBackend.check();
        if (update) {
          emit({
            status: "available",
            version: update.version,
            errorPhase: null,
            lastCheckReason: request.reason,
            bannerVisible: true,
          });
          return;
        }
        emit({
          status: "up-to-date",
          version: null,
          errorPhase: null,
          lastCheckReason: request.reason,
          bannerVisible: false,
        });
      } catch {
        emit({
          status: "error",
          version: snapshot.version,
          errorPhase: "check",
          lastCheckReason: request.reason,
          bannerVisible: false,
        });
      }
    })();

    try {
      await inFlight;
    } finally {
      inFlight = null;
    }

    return snapshot;
  };

  const install = async (): Promise<UpdateSnapshot> => {
    if (inFlight) return inFlight.then(() => snapshot);
    if (!activeBackend || snapshot.status === "installing") return snapshot;
    if (snapshot.status !== "available" && snapshot.status !== "error") {
      return snapshot;
    }
    if (snapshot.status === "error" && !snapshot.version) return snapshot;

    const currentBackend = activeBackend;
    const version = snapshot.version;
    emit({
      status: "installing",
      version,
      errorPhase: null,
      lastCheckReason: snapshot.lastCheckReason,
      bannerVisible: true,
    });

    inFlight = (async () => {
      try {
        await currentBackend.install();
      } catch {
        emit({
          status: "error",
          version,
          errorPhase: "install",
          lastCheckReason: snapshot.lastCheckReason,
          bannerVisible: true,
        });
      }
    })();

    try {
      await inFlight;
    } finally {
      inFlight = null;
    }

    return snapshot;
  };

  const dismiss = () => {
    if (snapshot.status === "available") {
      emit({ ...snapshot, bannerVisible: false });
      return;
    }
    if (snapshot.status === "error") {
      emit({
        ...IDLE_UPDATE_SNAPSHOT,
        version: snapshot.version,
        lastCheckReason: snapshot.lastCheckReason,
      });
    }
  };

  const reset = () => {
    inFlight = null;
    emit({ ...IDLE_UPDATE_SNAPSHOT });
  };

  return {
    getSnapshot: () => snapshot,
    setBackend: (next: UpdateBackend | null) => {
      activeBackend = next;
    },
    subscribe,
    check,
    install,
    dismiss,
    reset,
  };
}

export type UpdateController = ReturnType<typeof createUpdateController>;
