import { type UseHotkeyDefinition, useHotkeys } from "@tanstack/react-hotkeys";
import { createContext, type RefObject, useEffect } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { useViewerStore } from "@/stores/viewerStore";
import {
  ACTIONS,
  type ActionId,
  conditionMatches,
  type InputScope,
  resolveBindings,
  toHotkey,
} from "./bindings";

const suspensions = new Set<symbol>();
export const forwardedViewerKeys = new WeakSet<KeyboardEvent>();
const handledInputEvents = new WeakSet<KeyboardEvent>();
export function useInputSuspension(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const token = Symbol();
    suspensions.add(token);
    return () => {
      suspensions.delete(token);
    };
  }, [active]);
}
export function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    !!target.closest(
      "input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='textbox'], [role='combobox']",
    )
  );
}
export function inputsSuspended(): boolean {
  return (
    suspensions.size > 0 ||
    !!document.querySelector(
      "[role='dialog'][data-open], [role='alertdialog'][data-open], [role='menu'][data-open], [data-slot='sheet-content'][data-open]",
    )
  );
}
export function actionInputAllowed(
  scope: InputScope,
  event?: KeyboardEvent,
): boolean {
  if (inputsSuspended()) return false;
  if (scope === "grid" && useViewerStore.getState().isViewerOpen) return false;
  return (
    !event ||
    (!event.isComposing && event.key !== "Process" && !isEditable(event.target))
  );
}
export type ActionHandlers = Partial<Record<ActionId, () => void>>;
export const ApplicationActionsContext = createContext<ActionHandlers>({});
export function useActionInputs(
  scope: InputScope,
  handlers: ActionHandlers,
  options: {
    enabled?: boolean;
    isZoomed?: () => boolean;
    zoomed?: boolean;
    target?: RefObject<HTMLElement | null>;
  } = {},
) {
  const settings = useSettingsStore((state) => state.inputBindings);
  const definitions: UseHotkeyDefinition[] = [];
  for (const action of ACTIONS) {
    const handler = handlers[action.id];
    if (action.scope !== scope || !handler) continue;
    for (const binding of resolveBindings(settings, action.id)) {
      if (binding.type !== "keyboard") continue;
      definitions.push({
        hotkey: toHotkey(binding),
        callback: (event) => {
          if (
            handledInputEvents.has(event) ||
            forwardedViewerKeys.has(event) ||
            !conditionMatches(binding, options.isZoomed?.() ?? false) ||
            !actionInputAllowed(scope, event) ||
            (!action.repeat && event.repeat)
          )
            return;
          handledInputEvents.add(event);
          event.preventDefault();
          event.stopPropagation();
          handler();
        },
        options: {
          enabled:
            options.enabled !== false &&
            conditionMatches(
              binding,
              options.zoomed ?? options.isZoomed?.() ?? false,
            ),
          meta: { name: action.id },
        },
      });
    }
  }
  useHotkeys(definitions, {
    target: options.target,
    ignoreInputs: true,
    preventDefault: false,
    stopPropagation: false,
    conflictBehavior: "allow",
  });
}
