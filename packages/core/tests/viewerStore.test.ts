import { describe, expect, test } from "bun:test";
import { useViewerStore } from "../src/stores/viewerStore";
import type { WImage } from "../src/types";

describe("thumbnail updates", () => {
  test("notifies one thumbnail entry without replacing the gallery array", () => {
    const image: WImage = {
      source: "C:/gallery/photo.jpg",
      relativePath: "photo.jpg",
      width: 800,
      height: 600,
      sourceId: 7,
    };
    useViewerStore.setState({
      images: [image],
      requestedThumbs: new Set(["7:photo.jpg"]),
    });
    const imagesBefore = useViewerStore.getState().images;

    useViewerStore.getState().patchThumbnails(7, "photo.jpg", [
      { source: "mg-thumb:///source/entry?w=320", width: 320, height: 240 },
    ]);

    const state = useViewerStore.getState();
    expect(state.images).toBe(imagesBefore);
    expect(state.requestedThumbs.has("7:photo.jpg")).toBe(false);

    state.reset();
  });
});
