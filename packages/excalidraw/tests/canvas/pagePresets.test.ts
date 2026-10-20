import { getPageDimensions } from "@excalidraw/common";
import * as Element from "@excalidraw/element";
import rough from "roughjs/bin/rough";

import {
  actionChangePagePreset,
  actionTogglePageOrientation,
} from "../../actions/actionCanvas";
import {
  cleanAppStateForExport,
  clearAppStateForLocalStorage,
  clearAppStateForDatabase,
  getDefaultAppState,
} from "../../appState";
import { restoreAppState } from "../../data/restore";
import * as StaticScene from "../../renderer/staticScene";
import { Renderer } from "../../scene/Renderer";

import type {
  RenderableElementsMap,
  StaticCanvasRenderConfig,
} from "../../scene/types";
import type { AppState } from "../../types";

describe("pagePresets", () => {
  describe("dimensions at 96 DPI", () => {
    it("returns correct dimensions for A4 portrait and landscape", () => {
      const a4Portrait = getPageDimensions("A4", "portrait");
      expect(a4Portrait).not.toBeNull();
      expect(a4Portrait?.width).toBe(793.7);
      expect(a4Portrait?.height).toBe(1122.52);

      const a4Landscape = getPageDimensions("A4", "landscape");
      expect(a4Landscape).not.toBeNull();
      expect(a4Landscape?.width).toBe(1122.52);
      expect(a4Landscape?.height).toBe(793.7);
    });

    it("returns correct dimensions for A5 portrait and landscape", () => {
      const a5Portrait = getPageDimensions("A5", "portrait");
      expect(a5Portrait).not.toBeNull();
      expect(a5Portrait?.width).toBe(559.37);
      expect(a5Portrait?.height).toBe(793.7);

      const a5Landscape = getPageDimensions("A5", "landscape");
      expect(a5Landscape).not.toBeNull();
      expect(a5Landscape?.width).toBe(793.7);
      expect(a5Landscape?.height).toBe(559.37);
    });

    it("returns null for unknown preset or null", () => {
      expect(getPageDimensions(null)).toBeNull();
      expect(getPageDimensions("UNKNOWN" as any)).toBeNull();
    });
  });

  describe("actions center preservation", () => {
    const createBaseAppState = (overrides?: Partial<AppState>): AppState =>
      ({
        ...getDefaultAppState(),
        width: 1000,
        height: 800,
        offsetTop: 0,
        offsetLeft: 0,
        pagePreset: "A4",
        pageOrientation: "portrait",
        pageModeEnabled: true,
        scrollX: 100,
        scrollY: 200,
        zoom: { value: 1 as any },
        ...overrides,
      } as AppState);

    it("preserves center on actionChangePagePreset", () => {
      const appState = createBaseAppState();
      const prevDims = getPageDimensions("A4", "portrait")!;
      const nextDims = getPageDimensions("A5", "portrait")!;

      const result = (actionChangePagePreset.perform as any)([], appState, {
        preset: "A5",
        orientation: "portrait",
      });

      expect(result).not.toBe(false);
      const resAppState = (result as any).appState;
      expect(resAppState.pagePreset).toBe("A5");
      expect(resAppState.pageOrientation).toBe("portrait");
      expect(resAppState.pageModeEnabled).toBe(true);

      const expectedScrollX =
        appState.scrollX + (nextDims.width - prevDims.width) / 2;
      const expectedScrollY =
        appState.scrollY + (nextDims.height - prevDims.height) / 2;
      expect(resAppState.scrollX).toBeCloseTo(expectedScrollX, 5);
      expect(resAppState.scrollY).toBeCloseTo(expectedScrollY, 5);

      const prevCenterX = -appState.scrollX + prevDims.width / 2;
      const prevCenterY = -appState.scrollY + prevDims.height / 2;
      const nextCenterX = -resAppState.scrollX + nextDims.width / 2;
      const nextCenterY = -resAppState.scrollY + nextDims.height / 2;
      expect(nextCenterX).toBeCloseTo(prevCenterX, 5);
      expect(nextCenterY).toBeCloseTo(prevCenterY, 5);
    });

    it("centres the sheet in the viewport when leaving the infinite canvas", () => {
      const appState = createBaseAppState({
        pagePreset: null,
        pageModeEnabled: false,
        scrollX: 0,
        scrollY: 0,
      });

      const result = (actionChangePagePreset.perform as any)([], appState, {
        preset: "A4",
      });
      expect(result).not.toBe(false);
      const resAppState = (result as any).appState;

      const dims = getPageDimensions("A4", "portrait")!;
      const sheetLeft = -dims.width / 2 + resAppState.scrollX;
      const sheetTop = -dims.height / 2 + resAppState.scrollY;
      expect(sheetLeft + dims.width / 2).toBeCloseTo(appState.width / 2, 5);
      expect(sheetTop + dims.height / 2).toBeCloseTo(appState.height / 2, 5);
    });

    it("preserves center on actionTogglePageOrientation", () => {
      const appState = createBaseAppState({
        pagePreset: "A4",
        pageOrientation: "portrait",
      });
      const portraitDims = getPageDimensions("A4", "portrait")!;
      const landscapeDims = getPageDimensions("A4", "landscape")!;

      const result = (actionTogglePageOrientation.perform as any)(
        [],
        appState,
        null,
      );

      expect(result).not.toBe(false);
      const resAppState = (result as any).appState;
      expect(resAppState.pageOrientation).toBe("landscape");

      const expectedScrollX =
        appState.scrollX + (portraitDims.height - portraitDims.width) / 2;
      const expectedScrollY =
        appState.scrollY + (portraitDims.width - portraitDims.height) / 2;

      expect(resAppState.scrollX).toBeCloseTo(expectedScrollX, 5);
      expect(resAppState.scrollY).toBeCloseTo(expectedScrollY, 5);

      const prevCenterX = -appState.scrollX + portraitDims.width / 2;
      const prevCenterY = -appState.scrollY + portraitDims.height / 2;
      const nextCenterX = -resAppState.scrollX + landscapeDims.width / 2;
      const nextCenterY = -resAppState.scrollY + landscapeDims.height / 2;
      expect(nextCenterX).toBeCloseTo(prevCenterX, 5);
      expect(nextCenterY).toBeCloseTo(prevCenterY, 5);
    });
  });

  describe("paper sheet rendering", () => {
    type RectCall = {
      type: string;
      props: { x: number; y: number; width: number; height: number };
    };

    const renderSheet = (appState: Partial<AppState>) => {
      const scene = new Element.Scene([], { skipValidation: true });
      const renderer = new Renderer(scene);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 500;
      const context = canvas.getContext("2d") as any;
      context.__clearEvents();

      const state = {
        ...getDefaultAppState(),
        width: 500,
        height: 500,
        offsetLeft: 0,
        offsetTop: 0,
        scrollX: 0,
        scrollY: 0,
        zoom: { value: 1 as AppState["zoom"]["value"] },
        ...appState,
      } as AppState;

      const { elementsMap } = renderer.getRenderableElements({
        ...state,
        selectedElements: [],
      });

      StaticScene.renderStaticScene({
        canvas,
        rc: rough.canvas(canvas),
        scale: 1,
        elementsMap: elementsMap as RenderableElementsMap,
        allElementsMap: scene.getNonDeletedElementsMap(),
        visibleElements: [],
        appState: state,
        renderConfig: {
          imageCache: new Map(),
          renderGrid: false,
          isExporting: false,
          canvasBackgroundColor: "#fff",
          embedsValidationStatus: new Map(),
          elementsPendingErasure: new Set(),
          pendingFlowchartNodes: null,
          theme: "light",
        } as unknown as StaticCanvasRenderConfig,
      });

      const events = context.__getEvents() as RectCall[];
      return {
        strokeRects: events
          .filter((event) => event.type === "strokeRect")
          .map((event) => event.props),
        fillRects: events
          .filter((event) => event.type === "fillRect")
          .map((event) => event.props),
      };
    };

    it("draws an A4 paper sheet centered in scene space", () => {
      const { strokeRects, fillRects } = renderSheet({
        pageModeEnabled: true,
        pagePreset: "A4",
        pageOrientation: "portrait",
      });

      expect(strokeRects).toHaveLength(1);
      expect(strokeRects[0].x).toBeCloseTo(-396.85, 2);
      expect(strokeRects[0].y).toBeCloseTo(-561.26, 2);
      expect(strokeRects[0].width).toBeCloseTo(793.7, 2);
      expect(strokeRects[0].height).toBeCloseTo(1122.52, 2);

      const sheetFill = fillRects.find((rect) => rect.width === 793.7);
      expect(sheetFill).toBeDefined();
      expect(sheetFill!.x).toBeCloseTo(-396.85, 2);
      expect(sheetFill!.y).toBeCloseTo(-561.26, 2);
    });

    it("keeps the paper sheet pinned to scene space while panning", () => {
      const panned = renderSheet({
        pageModeEnabled: true,
        pagePreset: "A4",
        pageOrientation: "portrait",
        scrollX: 200,
        scrollY: 300,
      });

      expect(panned.strokeRects).toHaveLength(1);
      const rect = panned.strokeRects[0];
      // viewport-relative origin shifts by the scroll, scene-space origin does not
      expect(rect.x).toBeCloseTo(-396.85 + 200, 2);
      expect(rect.y).toBeCloseTo(-561.26 + 300, 2);
      expect(rect.x - 200).toBeCloseTo(-396.85, 2);
      expect(rect.y - 300).toBeCloseTo(-561.26, 2);
      expect(rect.width).toBeCloseTo(793.7, 2);
      expect(rect.height).toBeCloseTo(1122.52, 2);
    });

    it("fills the whole viewport with the workspace surface at any zoom", () => {
      // the workspace fill is drawn after `context.scale(zoom)`, so it must be
      // sized in scene units or the canvas background leaks at zoom != 1
      for (const zoom of [0.5, 1, 2]) {
        const { fillRects } = renderSheet({
          pageModeEnabled: true,
          pagePreset: "A4",
          pageOrientation: "portrait",
          zoom: { value: zoom as AppState["zoom"]["value"] },
        });

        // 500 css px of canvas == 500 / zoom scene units
        const workspace = fillRects.find(
          (rect) =>
            rect.x === 0 &&
            rect.y === 0 &&
            Math.abs(rect.width - 500 / zoom) < 0.01 &&
            Math.abs(rect.height - 500 / zoom) < 0.01,
        );
        expect(workspace).toBeDefined();
      }
    });

    it("bypasses paper sheet rendering when page mode is disabled", () => {
      const { strokeRects, fillRects } = renderSheet({
        pageModeEnabled: false,
        pagePreset: "A4",
        pageOrientation: "portrait",
      });

      expect(strokeRects).toHaveLength(0);
      expect(fillRects.some((rect) => rect.width === 793.7)).toBe(false);
    });

    it("bypasses paper sheet rendering when no preset is selected", () => {
      const { strokeRects } = renderSheet({
        pageModeEnabled: true,
        pagePreset: null,
        pageOrientation: "portrait",
      });

      expect(strokeRects).toHaveLength(0);
    });
  });

  describe("AppState serialization for pagePreset and pageOrientation", () => {
    it("preserves pagePreset and pageOrientation when exporting", () => {
      const appState: Partial<AppState> = {
        ...getDefaultAppState(),
        pagePreset: "A4",
        pageOrientation: "landscape",
        pageModeEnabled: true,
      };

      const exported = cleanAppStateForExport(appState);
      expect(exported.pagePreset).toBe("A4");
      expect(exported.pageOrientation).toBe("landscape");
      expect(exported.pageModeEnabled).toBe(true);

      const restored = restoreAppState(exported, null);
      expect(restored.pagePreset).toBe("A4");
      expect(restored.pageOrientation).toBe("landscape");
      expect(restored.pageModeEnabled).toBe(true);
    });

    it("preserves pagePreset and pageOrientation in local storage and database clean functions", () => {
      const appState: Partial<AppState> = {
        ...getDefaultAppState(),
        pagePreset: "A5",
        pageOrientation: "portrait",
        pageModeEnabled: true,
      };

      const local = clearAppStateForLocalStorage(appState);
      expect(local.pagePreset).toBe("A5");
      expect(local.pageOrientation).toBe("portrait");
      expect(local.pageModeEnabled).toBe(true);

      const db = clearAppStateForDatabase(appState);
      expect(db.pagePreset).toBe("A5");
      expect(db.pageOrientation).toBe("portrait");
      expect(db.pageModeEnabled).toBe(true);
    });
  });
});
