import { describe, expect, test } from "bun:test";
import { useAppStore } from "../src/stores/appStore";

describe("app sidebar visibility", () => {
  test("starts open and toggles independently of gallery folder sidebar", () => {
    useAppStore.setState({ isAppSidebarOpen: true, isSidebarOpen: false });

    expect(useAppStore.getState().isAppSidebarOpen).toBe(true);
    expect(useAppStore.getState().isSidebarOpen).toBe(false);

    useAppStore.getState().toggleAppSidebar();
    expect(useAppStore.getState().isAppSidebarOpen).toBe(false);
    expect(useAppStore.getState().isSidebarOpen).toBe(false);

    useAppStore.getState().setSidebarOpen(true);
    useAppStore.getState().reset();
    expect(useAppStore.getState().isAppSidebarOpen).toBe(false);
    expect(useAppStore.getState().isSidebarOpen).toBe(false);

    useAppStore.getState().setAppSidebarOpen(true);
    expect(useAppStore.getState().isAppSidebarOpen).toBe(true);
  });
});
