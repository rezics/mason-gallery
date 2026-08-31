import { describe, expect, test } from "bun:test";
import {
  createUpdateController,
  IDLE_UPDATE_SNAPSHOT,
  shouldStartUpdateCheck,
  type UpdateBackend,
  type UpdateCheckRequest,
} from "../src/updates/updateController";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createBackend(
  overrides: Partial<UpdateBackend> = {},
): UpdateBackend & {
  checkCalls: number;
} {
  const backend = {
    checkCalls: 0,
    check: async () => {
      backend.checkCalls += 1;
      return null;
    },
    install: async () => {},
    ...overrides,
  };
  return backend;
}

function request(
  reason: UpdateCheckRequest["reason"],
  overrides: Partial<UpdateCheckRequest> = {},
): UpdateCheckRequest {
  return {
    reason,
    canAutoUpdate: true,
    autoCheckEnabled: true,
    isProductionBuild: true,
    ...overrides,
  };
}

describe("update controller", () => {
  test("blocks launch auto-check in development without touching manual checks", () => {
    expect(
      shouldStartUpdateCheck(
        IDLE_UPDATE_SNAPSHOT,
        request("auto", { isProductionBuild: false }),
      ),
    ).toBe(false);
    expect(
      shouldStartUpdateCheck(
        IDLE_UPDATE_SNAPSHOT,
        request("manual", { isProductionBuild: false }),
      ),
    ).toBe(true);
    expect(
      shouldStartUpdateCheck(IDLE_UPDATE_SNAPSHOT, request("auto")),
    ).toBe(true);
  });

  test("skips auto checks when the setting is off", async () => {
    const backend = createBackend();
    const controller = createUpdateController(backend);

    await controller.check(request("auto", { autoCheckEnabled: false }));

    expect(backend.checkCalls).toBe(0);
    expect(controller.getSnapshot().status).toBe("idle");
  });

  test("does not call the updater for auto-check in development", async () => {
    const backend = createBackend();
    const controller = createUpdateController(backend);

    await controller.check(request("auto", { isProductionBuild: false }));

    expect(backend.checkCalls).toBe(0);
    expect(controller.getSnapshot().status).toBe("idle");
  });

  test("manual checks ignore the auto-check switch and development", async () => {
    const backend = createBackend();
    const controller = createUpdateController(backend);

    const snapshot = await controller.check(
      request("manual", {
        autoCheckEnabled: false,
        isProductionBuild: false,
      }),
    );

    expect(backend.checkCalls).toBe(1);
    expect(snapshot.status).toBe("up-to-date");
    expect(snapshot.lastCheckReason).toBe("manual");
  });

  test("does not start a second check while one is in flight", async () => {
    const pending = deferred<{ version: string } | null>();
    let checkCalls = 0;
    const controller = createUpdateController({
      check: () => {
        checkCalls += 1;
        return pending.promise;
      },
      install: async () => {},
    });

    const first = controller.check(request("manual"));
    const second = controller.check(request("auto"));

    expect(controller.getSnapshot().status).toBe("checking");
    pending.resolve(null);
    await Promise.all([first, second]);

    expect(checkCalls).toBe(1);
    expect(controller.getSnapshot().status).toBe("up-to-date");
  });

  test("surfaces an available update with a visible banner", async () => {
    const controller = createUpdateController({
      check: async () => ({ version: "2.2.0" }),
      install: async () => {},
    });

    const snapshot = await controller.check(request("auto"));

    expect(snapshot.status).toBe("available");
    expect(snapshot.version).toBe("2.2.0");
    expect(snapshot.bannerVisible).toBe(true);

    controller.dismiss();
    expect(controller.getSnapshot().bannerVisible).toBe(false);
    expect(controller.getSnapshot().status).toBe("available");
  });

  test("records distinct check and install errors", async () => {
    const controller = createUpdateController({
      check: async () => {
        throw new Error("network");
      },
      install: async () => {
        throw new Error("disk");
      },
    });

    const checkError = await controller.check(request("manual"));
    expect(checkError.status).toBe("error");
    expect(checkError.errorPhase).toBe("check");

    const available = createUpdateController({
      check: async () => ({ version: "2.2.0" }),
      install: async () => {
        throw new Error("disk");
      },
    });
    await available.check(request("manual"));
    const installError = await available.install();
    expect(installError.status).toBe("error");
    expect(installError.errorPhase).toBe("install");
    expect(installError.version).toBe("2.2.0");
  });

  test("hides update checks when the platform cannot auto-update", () => {
    expect(
      shouldStartUpdateCheck(
        IDLE_UPDATE_SNAPSHOT,
        request("manual", { canAutoUpdate: false }),
      ),
    ).toBe(false);
  });
});
