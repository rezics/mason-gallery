import { MenuBar } from "@mason-gallery/core";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Maximize2, Minus, X } from "lucide-react";
import type { ReactNode } from "react";
import { useRef } from "react";

function useAppWindow() {
  const ref = useRef<ReturnType<typeof getCurrentWindow> | null>(null);
  if (!ref.current) {
    ref.current = getCurrentWindow();
  }
  return ref.current;
}

function WindowButton({
  title,
  danger,
  onClick,
  children,
}: {
  title: string;
  danger?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className={`flex h-9 w-9 items-center justify-center transition-colors hover:bg-accent ${
        danger ? "hover:bg-destructive hover:text-destructive-foreground" : ""
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function WindowControls() {
  const appWindow = useAppWindow();

  return (
    <>
      <WindowButton
        title="Minimize"
        onClick={() => appWindow.minimize().catch(console.error)}
      >
        <Minus className="size-4" />
      </WindowButton>
      <WindowButton
        title="Maximize"
        onClick={() => appWindow.toggleMaximize().catch(console.error)}
      >
        <Maximize2 className="size-3.5" />
      </WindowButton>
      <WindowButton
        title="Close"
        danger
        onClick={() => appWindow.close().catch(console.error)}
      >
        <X className="size-4" />
      </WindowButton>
    </>
  );
}

export default function Titlebar() {
  const appWindow = useAppWindow();

  return (
    <MenuBar
      draggable
      onQuit={() => appWindow.close().catch(console.error)}
      onDevTools={() => invoke("open_devtools").catch(console.error)}
      trailing={<WindowControls />}
    />
  );
}
