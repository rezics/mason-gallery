import { describe, expect, test } from "bun:test";
import {
  matchesKeyboardEvent,
  rawHotkeyToParsedHotkey,
} from "@tanstack/react-hotkeys";
import {
  ACTIONS,
  bindingSchema,
  bindingsOverlap,
  defaultInputSettings,
  findBindingConflicts,
  fromHotkey,
  inputSettingsSchema,
  resolveBindings,
  scopesOverlap,
  type KeyboardBinding,
} from "../src/input/bindings";
import {
  normalizeWheelDelta,
  PointerClickTracker,
  WheelNavigationGate,
} from "../src/input/gestures";
import {
  createDefaultSettings,
  createSettingsEnvelope,
  migrateSettingsEnvelope,
} from "../src/persistence/settingsSchema";

const key = (value: string): KeyboardBinding => ({
  type: "keyboard",
  key: value,
  match: "key",
  modifiers: [],
});
describe("action bindings", () => {
  test("default zoom keys cover shifted punctuation, numpad and primary modifiers", () => {
    const matches = (
      id: "viewer.zoomIn" | "viewer.zoomOut",
      event: Partial<KeyboardEvent>,
    ) =>
      resolveBindings(defaultInputSettings(), id).some(
        (binding) =>
          binding.type === "keyboard" &&
          matchesKeyboardEvent(
            {
              key: "",
              code: "",
              ctrlKey: false,
              altKey: false,
              shiftKey: false,
              metaKey: false,
              getModifierState: () => false,
              ...event,
            } as KeyboardEvent,
            rawHotkeyToParsedHotkey(
              {
                key: binding.key,
                ctrl: binding.modifiers.includes("Control"),
                shift: binding.modifiers.includes("Shift"),
                mod: binding.modifiers.includes("Mod"),
              },
              "windows",
            ),
            "windows",
          ),
      );
    expect(
      matches("viewer.zoomIn", { key: "+", code: "Equal", shiftKey: true }),
    ).toBe(true);
    expect(matches("viewer.zoomIn", { key: "+", code: "NumpadAdd" })).toBe(
      true,
    );
    expect(
      matches("viewer.zoomIn", {
        key: "+",
        code: "Equal",
        shiftKey: true,
        ctrlKey: true,
      }),
    ).toBe(true);
    expect(
      matches("viewer.zoomOut", {
        key: "_",
        code: "Minus",
        shiftKey: true,
        ctrlKey: true,
      }),
    ).toBe(true);
  });
  test("empty overrides disable an action; removing the override restores its preset", () => {
    const settings = defaultInputSettings();
    const defaults = resolveBindings(settings, "viewer.next");
    settings.overrides["viewer.next"] = [];
    expect(resolveBindings(settings, "viewer.next")).toEqual([]);
    delete settings.overrides["viewer.next"];
    expect(resolveBindings(settings, "viewer.next")).toEqual(defaults);
    expect(resolveBindings(settings, "viewer.close").length).toBeGreaterThan(0);
  });
  test("all preset bindings are valid and have no internal action conflicts", () => {
    for (const preset of ["current", "wheel-navigation"] as const) {
      const settings = { preset, overrides: {} };
      for (const action of ACTIONS) {
        const bindings = resolveBindings(settings, action.id);
        expect(
          bindings.every((binding) => bindingSchema.safeParse(binding).success),
        ).toBe(true);
        expect(findBindingConflicts(settings, action.id, bindings)).toEqual([]);
      }
    }
  });
  test("viewer and grid are exclusive; application bindings compete in both", () => {
    expect(scopesOverlap("grid", "viewer")).toBe(false);
    expect(scopesOverlap("app", "viewer")).toBe(true);
    const settings = defaultInputSettings();
    expect(
      findBindingConflicts(settings, "viewer.close", [key("Escape")]),
    ).not.toContain("grid.cancelSelection");
    expect(
      findBindingConflicts(settings, "app.settings", [key("Escape")]),
    ).toContain("viewer.close");
    expect(
      findBindingConflicts(settings, "viewer.info", [key("Delete")], {
        canDeleteFiles: false,
      }),
    ).toEqual([]);
  });
  test("physical and logical bindings detect possible layout overlap but exclude navigation keys", () => {
    const physical = fromHotkey("Alt+[KeyK]");
    expect(physical).toMatchObject({
      key: "KeyK",
      match: "code",
      modifiers: ["Alt"],
    });
    expect(bindingsOverlap(physical, { ...key("K"), modifiers: ["Alt"] })).toBe(
      true,
    );
    expect(
      bindingsOverlap({ ...physical, modifiers: [] }, key("ArrowLeft")),
    ).toBe(false);
    expect(
      bindingsOverlap(
        { ...key("S"), modifiers: ["Mod"] },
        { ...key("S"), modifiers: ["Meta"] },
      ),
    ).toBe(true);
    expect(
      bindingsOverlap(
        { ...key("ArrowLeft"), condition: "zoomed" },
        { ...key("ArrowLeft"), condition: "unzoomed" },
      ),
    ).toBe(false);
  });
  test("rejects malformed, duplicate modifiers and pinch-wheel assignments", () => {
    expect(
      inputSettingsSchema.safeParse({
        preset: "current",
        overrides: {
          "app.settings": [
            { type: "mouse", button: "left", click: "single", modifiers: [] },
          ],
        },
      }).success,
    ).toBe(false);
    expect(bindingSchema.safeParse({ ...key(""), modifiers: [] }).success).toBe(
      false,
    );
    expect(
      bindingSchema.safeParse({ ...key("A"), modifiers: ["Shift", "Shift"] })
        .success,
    ).toBe(false);
    expect(
      bindingSchema.safeParse({
        type: "wheel",
        direction: "up",
        modifiers: ["Control"],
      }).success,
    ).toBe(false);
    expect(
      inputSettingsSchema.safeParse({
        preset: "current",
        overrides: { unknown: [] },
      }).success,
    ).toBe(false);
  });
  test("migrates v3 without replacing user preferences and round-trips custom bindings", () => {
    const { inputBindings: _, ...old } = createDefaultSettings();
    const migrated = migrateSettingsEnvelope({
      version: 3,
      settings: { ...old, language: "ja", externalDropBehavior: "open-only" },
    });
    expect(migrated.version).toBe(4);
    expect(migrated.settings.language).toBe("ja");
    expect(migrated.settings.externalDropBehavior).toBe("open-only");
    expect(migrated.settings.inputBindings).toEqual(defaultInputSettings());
    migrated.settings.inputBindings = {
      preset: "wheel-navigation",
      overrides: { "viewer.next": [fromHotkey("[KeyJ]")], "viewer.zoomIn": [] },
    };
    const envelope = createSettingsEnvelope(migrated.settings);
    expect(
      migrateSettingsEnvelope(JSON.parse(JSON.stringify(envelope))),
    ).toEqual(envelope);
  });
});
describe("viewer gestures", () => {
  test("normalizes pixel, line and page wheel events", () => {
    expect(normalizeWheelDelta(3, 0, 800)).toBe(3);
    expect(normalizeWheelDelta(3, 1, 800)).toBe(48);
    expect(normalizeWheelDelta(-1, 2, 800)).toBe(-800);
  });
  test("accumulates tiny deltas, rejects inertia and waits for swipe animation", () => {
    const gate = new WheelNavigationGate();
    expect(gate.consume(8, 0, 500)).toBe(false);
    expect(gate.consume(20, 10, 500)).toBe(false);
    expect(gate.consume(20, 20, 500)).toBe(true);
    for (let time = 40; time < 800; time += 40)
      expect(gate.consume(10, time, 500)).toBe(false);
    expect(gate.consume(60, 1000, 500)).toBe(true);
    expect(gate.consume(-60, 1200, 500)).toBe(false);
    expect(gate.consume(-60, 1600, 500)).toBe(true);
  });
  test("dragging out and back is still a drag; cancelled pointers do not click", () => {
    const pointer = new PointerClickTracker();
    pointer.down(1, 0, 0);
    pointer.move(1, 30, 0);
    expect(pointer.up(1, 0, 0)).toBe(false);
    pointer.down(2, 10, 10);
    pointer.cancel();
    expect(pointer.up(2, 10, 10)).toBe(false);
    pointer.down(3, 10, 10);
    expect(pointer.up(3, 12, 12)).toBe(true);
  });
});
