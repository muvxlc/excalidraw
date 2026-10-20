import { getPageDimensions } from "@excalidraw/common";

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
