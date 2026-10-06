import {
  normalizeRegisterableHotkey,
  parseHotkey,
  type RawHotkey,
  validateHotkey,
} from "@tanstack/react-hotkeys";
import { z } from "zod";

export const ACTION_IDS = [
  "app.settings",
  "grid.jump",
  "grid.selectAll",
  "grid.cancelSelection",
  "viewer.previous",
  "viewer.next",
  "viewer.zoomIn",
  "viewer.zoomOut",
  "viewer.resetZoom",
  "viewer.toggleZoom",
  "viewer.close",
  "viewer.info",
  "viewer.delete",
  "viewer.reveal",
  "viewer.panLeft",
  "viewer.panRight",
  "viewer.panUp",
  "viewer.panDown",
] as const;
export type ActionId = (typeof ACTION_IDS)[number];
export type InputScope = "app" | "grid" | "viewer";
export const modifiersSchema = z
  .array(z.enum(["Control", "Alt", "Shift", "Meta", "Mod"]))
  .max(4)
  .refine(
    (values) =>
      new Set(values).size === values.length &&
      !(
        values.includes("Mod") &&
        (values.includes("Control") || values.includes("Meta"))
      ),
  );
export type Modifier = z.infer<typeof modifiersSchema>[number];
const condition = z.enum(["zoomed", "unzoomed"]).optional();
export const bindingSchema = z
  .discriminatedUnion("type", [
    z
      .object({
        type: z.literal("keyboard"),
        key: z.string().min(1).max(40),
        match: z.enum(["key", "code"]),
        logicalKey: z.string().min(1).max(40).optional(),
        modifiers: modifiersSchema,
        condition,
      })
      .strict(),
    z
      .object({
        type: z.literal("mouse"),
        button: z.enum(["left", "middle", "right"]),
        click: z.enum(["single", "double"]),
        modifiers: modifiersSchema,
        condition,
      })
      .strict(),
    z
      .object({
        type: z.literal("wheel"),
        direction: z.enum(["up", "down"]),
        modifiers: modifiersSchema,
        condition,
      })
      .strict(),
  ])
  .superRefine((binding, ctx) => {
    if (binding.type === "keyboard") {
      try {
        const hotkey = normalizeRegisterableHotkey(toHotkey(binding));
        if (!validateHotkey(hotkey).valid)
          throw new Error("Invalid keyboard binding");
      } catch {
        ctx.addIssue({ code: "custom", message: "Invalid keyboard binding" });
      }
    }
    if (
      binding.type === "wheel" &&
      (binding.modifiers.includes("Control") ||
        binding.modifiers.includes("Mod"))
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Control-wheel is reserved for pinch zoom",
      });
    }
  });
export type InputBinding = z.infer<typeof bindingSchema>;
export type KeyboardBinding = Extract<InputBinding, { type: "keyboard" }>;
export const inputSettingsSchema = z
  .object({
    preset: z.enum(["current", "wheel-navigation"]),
    overrides: z.partialRecord(
      z.enum(ACTION_IDS),
      z.array(bindingSchema).max(16),
    ),
  })
  .strict()
  .superRefine((settings, ctx) => {
    for (const [id, bindings] of Object.entries(settings.overrides)) {
      if (id.startsWith("viewer.")) continue;
      if (
        bindings?.some(
          (binding) => binding.type !== "keyboard" || binding.condition,
        )
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["overrides", id],
          message:
            "Application and grid actions require unconditional keyboard bindings",
        });
      }
    }
  });
export type InputSettings = z.infer<typeof inputSettingsSchema>;
export const defaultInputSettings = (): InputSettings => ({
  preset: "current",
  overrides: {},
});

const keyboard = (
  key: string,
  modifiers: Modifier[] = [],
  when?: "zoomed" | "unzoomed",
): KeyboardBinding => ({
  type: "keyboard",
  key,
  match: "key",
  modifiers,
  condition: when,
});
const wheel = (direction: "up" | "down"): InputBinding => ({
  type: "wheel",
  direction,
  modifiers: [],
});
const mouse = (
  button: "left" | "right",
  click: "single" | "double" = "single",
): InputBinding => ({ type: "mouse", button, click, modifiers: [] });
export const ACTIONS: {
  id: ActionId;
  scope: InputScope;
  labelKey: string;
  repeat?: boolean;
  capability?: "canDeleteFiles" | "canRevealFile" | "canBatchMoveFiles";
}[] = ACTION_IDS.map((id) => ({
  id,
  scope: id.split(".")[0] as InputScope,
  labelKey: `settings:action_${id.replace(".", "_")}`,
  repeat: /previous|next|zoomIn|zoomOut|pan/.test(id),
  capability:
    id === "viewer.delete"
      ? "canDeleteFiles"
      : id === "viewer.reveal"
        ? "canRevealFile"
        : id === "grid.selectAll" || id === "grid.cancelSelection"
          ? "canBatchMoveFiles"
          : undefined,
}));

export function defaultBindings(
  id: ActionId,
  preset: InputSettings["preset"],
): InputBinding[] {
  const current = preset === "current";
  switch (id) {
    case "app.settings":
      return [keyboard(",", ["Mod"])];
    case "grid.jump":
      return [keyboard("G", ["Control"])];
    case "grid.selectAll":
      return [keyboard("A", ["Mod"])];
    case "grid.cancelSelection":
      return [keyboard("Escape")];
    case "viewer.previous":
      return [
        keyboard("ArrowLeft", [], current ? "unzoomed" : undefined),
        ...(!current ? [wheel("up")] : []),
      ];
    case "viewer.next":
      return [
        keyboard("ArrowRight", [], current ? "unzoomed" : undefined),
        ...(!current ? [wheel("down")] : []),
      ];
    case "viewer.zoomIn":
      return [
        keyboard("+"),
        keyboard("=", ["Shift"]),
        keyboard("=", ["Mod", "Shift"]),
        keyboard("=", ["Mod"]),
        current ? wheel("up") : mouse("left"),
      ];
    case "viewer.zoomOut":
      return [
        keyboard("-"),
        keyboard("-", ["Mod"]),
        keyboard("-", ["Mod", "Shift"]),
        current ? wheel("down") : mouse("right"),
      ];
    case "viewer.resetZoom":
      return [keyboard("0", ["Mod"])];
    case "viewer.toggleZoom":
      return current ? [mouse("left", "double")] : [];
    case "viewer.close":
      return [keyboard("Escape")];
    case "viewer.delete":
      return [keyboard("Delete")];
    case "viewer.panLeft":
      return current ? [keyboard("ArrowLeft", [], "zoomed")] : [];
    case "viewer.panRight":
      return current ? [keyboard("ArrowRight", [], "zoomed")] : [];
    case "viewer.panUp":
      return current ? [keyboard("ArrowUp", [], "zoomed")] : [];
    case "viewer.panDown":
      return current ? [keyboard("ArrowDown", [], "zoomed")] : [];
    default:
      return [];
  }
}
export function resolveBindings(
  settings: InputSettings,
  id: ActionId,
): InputBinding[] {
  return settings.overrides[id] ?? defaultBindings(id, settings.preset);
}
export function toHotkey(binding: KeyboardBinding): RawHotkey {
  const modifiers = {
    ctrl: binding.modifiers.includes("Control"),
    alt: binding.modifiers.includes("Alt"),
    shift: binding.modifiers.includes("Shift"),
    meta: binding.modifiers.includes("Meta"),
    mod: binding.modifiers.includes("Mod"),
  };
  return binding.match === "code"
    ? { ...modifiers, code: binding.key }
    : { ...modifiers, key: binding.key };
}
export function fromHotkey(
  hotkey: string,
  logicalKey?: string,
): KeyboardBinding {
  const parsed = parseHotkey(hotkey);
  return {
    type: "keyboard",
    key: parsed.code ?? parsed.key ?? "",
    match: parsed.code ? "code" : "key",
    modifiers: parsed.modifiers,
    ...(parsed.code && logicalKey ? { logicalKey } : {}),
  };
}
export function conditionMatches(
  binding: InputBinding,
  zoomed: boolean,
): boolean {
  return !binding.condition || (binding.condition === "zoomed") === zoomed;
}
export function modifiersMatch(
  binding: InputBinding,
  event: {
    ctrlKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
    metaKey: boolean;
  },
  mac = typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.platform),
): boolean {
  const mods = binding.modifiers;
  return (
    event.ctrlKey ===
      (mods.includes("Control") || (mods.includes("Mod") && !mac)) &&
    event.metaKey ===
      (mods.includes("Meta") || (mods.includes("Mod") && mac)) &&
    event.altKey === mods.includes("Alt") &&
    event.shiftKey === mods.includes("Shift")
  );
}
export function scopesOverlap(a: InputScope, b: InputScope): boolean {
  return a === b || a === "app" || b === "app";
}
export function bindingsOverlap(a: InputBinding, b: InputBinding): boolean {
  if (
    a.type !== b.type ||
    (a.condition && b.condition && a.condition !== b.condition)
  )
    return false;
  // Check both platforms so portable Mod bindings cannot hide a conflict.
  const modsOverlap = [false, true].some((mac) => {
    const event = {
      ctrlKey:
        a.modifiers.includes("Control") ||
        (a.modifiers.includes("Mod") && !mac),
      metaKey:
        a.modifiers.includes("Meta") || (a.modifiers.includes("Mod") && mac),
      altKey: a.modifiers.includes("Alt"),
      shiftKey: a.modifiers.includes("Shift"),
    };
    return modifiersMatch(b, event, mac);
  });
  if (!modsOverlap) return false;
  if (a.type === "keyboard" && b.type === "keyboard") {
    if (a.match === b.match) return a.key.toLowerCase() === b.key.toLowerCase();
    const code = a.match === "code" ? a.key : b.key;
    const key = a.match === "key" ? a.key : b.key;
    const physical = a.match === "code" ? a : b;
    // Recorded physical bindings retain the observed character for this layout.
    // Manually entered codes use their conventional character as a fallback.
    const logical =
      physical.logicalKey ??
      (/^Key[A-Z]$/.test(code)
        ? code.slice(3)
        : /^Digit\d$/.test(code)
          ? code.slice(5)
          : code);
    return (
      logical.toLowerCase() === key.toLowerCase() ||
      code === key ||
      (code === "Equal" && ["=", "+"].includes(key)) ||
      (code === "Minus" && ["-", "_"].includes(key))
    );
  }
  if (a.type === "mouse" && b.type === "mouse")
    return a.button === b.button && a.click === b.click;
  return (
    a.type === "wheel" && b.type === "wheel" && a.direction === b.direction
  );
}
export function findBindingConflicts(
  settings: InputSettings,
  id: ActionId,
  bindings: InputBinding[],
  capabilities?: Partial<
    Record<"canDeleteFiles" | "canRevealFile" | "canBatchMoveFiles", boolean>
  >,
): ActionId[] {
  const scope = ACTIONS.find((action) => action.id === id)?.scope ?? "app";
  return ACTIONS.filter(
    (action) =>
      action.id !== id &&
      (!capabilities ||
        !action.capability ||
        capabilities[action.capability]) &&
      scopesOverlap(scope, action.scope) &&
      bindings.some((a) =>
        resolveBindings(settings, action.id).some((b) => bindingsOverlap(a, b)),
      ),
  ).map((action) => action.id);
}
