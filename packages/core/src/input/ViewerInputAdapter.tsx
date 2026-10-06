import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
} from "react";
import {
  createModule,
  MODULE_CONTROLLER,
  type Plugin,
  useController,
  useLightboxProps,
} from "yet-another-react-lightbox";
import { useSettingsStore } from "@/stores/settingsStore";
import {
  ACTIONS,
  type ActionId,
  conditionMatches,
  type InputBinding,
  modifiersMatch,
  resolveBindings,
} from "./bindings";
import {
  normalizeWheelDelta,
  PointerClickTracker,
  WheelNavigationGate,
} from "./gestures";
import {
  type ActionHandlers,
  ApplicationActionsContext,
  actionInputAllowed,
  forwardedViewerKeys,
  isEditable,
  useActionInputs,
} from "./useActionInputs";

export const ViewerActionsContext = createContext<{
  handlers: ActionHandlers;
  isZoomed: () => boolean;
  zoomed: boolean;
  wheelZoom: (delta: number, event: WheelEvent) => void;
}>({ handlers: {}, isZoomed: () => false, zoomed: false, wheelZoom: () => {} });
const DOUBLE_CLICK_DELAY = 500;

function ViewerInputAdapter({ children }: { children?: ReactNode }) {
  const { containerRef } = useController();
  const { animation } = useLightboxProps();
  const {
    handlers: suppliedHandlers,
    isZoomed,
    zoomed,
    wheelZoom,
  } = useContext(ViewerActionsContext);
  const pan = (key: string) => {
    if (!isZoomed()) return;
    // Forward only the pan action to YARL's public container; custom bindings
    // never leak their original key into its navigation/zoom sensors.
    const event = new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
    });
    forwardedViewerKeys.add(event);
    containerRef.current?.dispatchEvent(event);
  };
  const handlers = {
    ...suppliedHandlers,
    "viewer.panLeft": () => pan("ArrowLeft"),
    "viewer.panRight": () => pan("ArrowRight"),
    "viewer.panUp": () => pan("ArrowUp"),
    "viewer.panDown": () => pan("ArrowDown"),
  };
  const settings = useSettingsStore((state) => state.inputBindings);
  const latest = useRef({ settings, handlers, isZoomed, wheelZoom });
  latest.current = { settings, handlers, isZoomed, wheelZoom };
  useActionInputs("viewer", handlers, {
    target: containerRef,
    isZoomed,
    zoomed,
  });
  const applicationHandlers = useContext(ApplicationActionsContext);
  useActionInputs("app", applicationHandlers, { target: containerRef });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const gate = new WheelNavigationGate();
    const pointer = new PointerClickTracker();
    let pendingClick: ReturnType<typeof setTimeout> | undefined;
    let lastClick:
      | {
          button: number;
          time: number;
          x: number;
          y: number;
          target: EventTarget | null;
          modifiers: string;
        }
      | undefined;
    const imageRegion = (target: EventTarget | null) =>
      target instanceof Element && !!target.closest(".yarl__slide_image");
    const find = (predicate: (binding: InputBinding) => boolean) => {
      const state = latest.current;
      return ACTIONS.find(
        (action) =>
          action.scope === "viewer" &&
          state.handlers[action.id] &&
          resolveBindings(state.settings, action.id).some(
            (binding) =>
              conditionMatches(binding, state.isZoomed()) && predicate(binding),
          ),
      )?.id;
    };
    const execute = (action: ActionId | undefined) => {
      if (action && actionInputAllowed("viewer"))
        latest.current.handlers[action]?.();
    };
    const onWheel = (event: WheelEvent) => {
      // YARL owns Ctrl-wheel (trackpad pinch) and touch pointers.
      if (!imageRegion(event.target)) return;
      if (event.ctrlKey && actionInputAllowed("viewer")) {
        event.preventDefault();
        return;
      }
      if (
        Math.abs(event.deltaX) > Math.abs(event.deltaY) &&
        latest.current.settings.preset === "current" &&
        !latest.current.isZoomed() &&
        actionInputAllowed("viewer")
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      if (
        !actionInputAllowed("viewer") ||
        Math.abs(event.deltaY) <= Math.abs(event.deltaX)
      )
        return;
      const delta = normalizeWheelDelta(
        event.deltaY,
        event.deltaMode,
        element.clientHeight,
      );
      const id = find(
        (binding) =>
          binding.type === "wheel" &&
          binding.direction === (delta < 0 ? "up" : "down") &&
          modifiersMatch(binding, event),
      );
      if (!id) return;
      if (id === "viewer.zoomIn" || id === "viewer.zoomOut") {
        latest.current.wheelZoom(
          (id === "viewer.zoomIn" ? -1 : 1) * Math.abs(delta),
          event,
        );
      } else if (gate.consume(delta, performance.now(), animation.swipe))
        execute(id);
    };
    const suppressLegacyKeys = (event: KeyboardEvent) => {
      // This native listener runs before the React portal's delegated sensors.
      // Even a disabled/remapped default must never fall through to YARL.
      if (
        !forwardedViewerKeys.has(event) &&
        !isEditable(event.target) &&
        [
          "ArrowLeft",
          "ArrowRight",
          "ArrowUp",
          "ArrowDown",
          "+",
          "-",
          "=",
          "_",
          "0",
          "Escape",
        ].includes(event.key)
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const onDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") pointer.cancel();
      if (
        event.button === 1 &&
        imageRegion(event.target) &&
        find(
          (binding) =>
            binding.type === "mouse" &&
            binding.button === "middle" &&
            modifiersMatch(binding, event),
        )
      )
        event.preventDefault();
      if (event.pointerType === "mouse" && imageRegion(event.target))
        pointer.down(event.pointerId, event.clientX, event.clientY);
    };
    const onMove = (event: PointerEvent) =>
      pointer.move(event.pointerId, event.clientX, event.clientY);
    const cancel = () => {
      pointer.cancel();
      clearTimeout(pendingClick);
      lastClick = undefined;
    };
    const onUp = (event: PointerEvent) => {
      if (
        event.pointerType !== "mouse" ||
        !pointer.up(event.pointerId, event.clientX, event.clientY) ||
        !imageRegion(event.target) ||
        !actionInputAllowed("viewer")
      )
        return;
      const button = (["left", "middle", "right"] as const)[event.button];
      if (!button) return;
      const match = (click: "single" | "double") =>
        find(
          (binding) =>
            binding.type === "mouse" &&
            binding.button === button &&
            binding.click === click &&
            modifiersMatch(binding, event),
        );
      const single = match("single");
      const double = match("double");
      const modifiers = [
        event.ctrlKey,
        event.altKey,
        event.shiftKey,
        event.metaKey,
      ].join(",");
      if (
        double &&
        lastClick?.button === event.button &&
        lastClick.target === event.target &&
        lastClick.modifiers === modifiers &&
        performance.now() - lastClick.time < DOUBLE_CLICK_DELAY &&
        Math.hypot(event.clientX - lastClick.x, event.clientY - lastClick.y) <=
          8
      ) {
        clearTimeout(pendingClick);
        lastClick = undefined;
        execute(double);
      } else {
        clearTimeout(pendingClick);
        lastClick = {
          button: event.button,
          time: performance.now(),
          x: event.clientX,
          y: event.clientY,
          target: event.target,
          modifiers,
        };
        if (double)
          pendingClick = setTimeout(() => {
            execute(single);
            lastClick = undefined;
          }, DOUBLE_CLICK_DELAY);
        else execute(single);
      }
    };
    const onContextMenu = (event: MouseEvent) => {
      if (
        imageRegion(event.target) &&
        find(
          (binding) =>
            binding.type === "mouse" &&
            binding.button === "right" &&
            modifiersMatch(binding, event),
        )
      )
        event.preventDefault();
    };
    element.addEventListener("keydown", suppressLegacyKeys);
    element.addEventListener("wheel", onWheel, {
      capture: true,
      passive: false,
    });
    element.addEventListener("pointerdown", onDown, true);
    element.addEventListener("pointermove", onMove, true);
    element.addEventListener("pointerup", onUp, true);
    element.addEventListener("pointercancel", cancel, true);
    element.addEventListener("contextmenu", onContextMenu);
    return () => {
      cancel();
      element.removeEventListener("keydown", suppressLegacyKeys);
      element.removeEventListener("wheel", onWheel, true);
      element.removeEventListener("pointerdown", onDown, true);
      element.removeEventListener("pointermove", onMove, true);
      element.removeEventListener("pointerup", onUp, true);
      element.removeEventListener("pointercancel", cancel, true);
      element.removeEventListener("contextmenu", onContextMenu);
    };
  }, [containerRef, animation.swipe]);
  return children;
}
export const ViewerInputPlugin: Plugin = ({ addChild }) =>
  addChild(
    MODULE_CONTROLLER,
    createModule("ViewerInputAdapter", ViewerInputAdapter),
  );
