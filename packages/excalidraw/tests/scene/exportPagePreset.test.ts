import { getPageDimensions } from "@excalidraw/common";

import type { SceneFontAsset } from "@excalidraw/common";
import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { exportScene } from "../../scene/export";
import { API } from "../helpers/api";

describe("exportPagePreset", () => {
  const dummyRectangle = API.createElement({
    type: "rectangle",
    id: "rect-1",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  });

  describe("exportToCanvas", () => {
    it("exports with A4 portrait mode (794 x 1123 px at 1x)", async () => {
      const canvas = await exportScene({
        type: "canvas",
        data: {
          elements: [dummyRectangle] as NonDeletedExcalidrawElement[],
          appState: {
            pageModeEnabled: true,
            pagePreset: "A4",
            pageOrientation: "portrait",
          },
          files: null,
        },
      });

      expect(canvas.width).toBe(794);
      expect(canvas.height).toBe(1123);
    });
  });

  describe("exportToSvg", () => {
    it("matches A4 bounds with pageModeEnabled", async () => {
      const a4Dims = getPageDimensions("A4", "portrait")!;
      const svg = await exportScene({
        type: "svg",
        data: {
          elements: [dummyRectangle] as NonDeletedExcalidrawElement[],
          appState: {
            pageModeEnabled: true,
            pagePreset: "A4",
            pageOrientation: "portrait",
          },
          files: null,
        },
      });

      expect(svg.getAttribute("width")).toBe(`${a4Dims.width}`);
      expect(svg.getAttribute("height")).toBe(`${a4Dims.height}`);
      expect(svg.getAttribute("viewBox")).toBe(
        `0 0 ${a4Dims.width} ${a4Dims.height}`,
      );
    });

    it("exports SVG with custom fontRef asserting embedded @font-face data URL", async () => {
      const customFontRef =
        "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" as const;
      const customDataUrl = "data:font/woff2;base64,d09GMgABAAAAAA==";

      const customFontAsset: SceneFontAsset = {
        id: customFontRef,
        name: "CustomFont",
        format: "woff2",
        data: customDataUrl,
        metrics: {
          unitsPerEm: 1000,
          ascender: 800,
          descender: -200,
          lineHeight: 1.2,
        },
      };

      const textElement = API.createElement({
        type: "text",
        id: "custom-text-1",
        text: "Custom Font Test",
        fontFamily: 1,
        fontRef: customFontRef,
        x: 10,
        y: 10,
        width: 150,
        height: 30,
      });

      const svg = await exportScene({
        type: "svg",
        data: {
          elements: [textElement] as NonDeletedExcalidrawElement[],
          appState: {
            fonts: {
              [customFontRef]: customFontAsset,
            },
          },
          files: null,
        },
      });

      const styleFonts = svg.querySelector("style.style-fonts");
      expect(styleFonts).not.toBeNull();
      const cssContent = styleFonts?.textContent || "";

      expect(cssContent).toContain("@font-face");
      expect(cssContent).toContain("ExcalidrawCustom_0123456789abcdef");
      expect(cssContent).toContain(`url('${customDataUrl}')`);
      expect(cssContent).toContain("format('woff2')");
    });
  });
});
