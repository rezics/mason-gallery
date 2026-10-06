import { expect, test } from "bun:test";
import {
  ControllerModule,
  createNode,
  withPlugins,
} from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import { ViewerInputPlugin } from "../src/input/ViewerInputAdapter";

test("input adapter mounts in YARL's real controller tree alongside Zoom", () => {
  const { config } = withPlugins(
    [createNode(ControllerModule)],
    [Zoom, ViewerInputPlugin],
  );
  const controller = config[0];
  expect(controller.module.name).toBe("controller");
  expect(
    controller.children.some(
      (node) => node.module.name === "ViewerInputAdapter",
    ),
  ).toBe(true);
  expect(controller.children.some((node) => node.module.name === "zoom")).toBe(
    true,
  );
});
