import { Excalidraw, useExcalidrawAPI } from "@excalidraw/excalidraw";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@excalidraw/excalidraw/tests/test-utils";
import { beforeEach, describe, expect, it } from "vitest";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { Provider, appJotaiStore } from "../app-jotai";
import { AppMainMenu, openAIDiagram } from "../components/AppMainMenu";
import {
  AISettingsDialog,
  aiSettingsDialogOpenAtom,
} from "../components/AISettingsDialog";

describe("AppMainMenu AI items", () => {
  beforeEach(() => {
    appJotaiStore.set(aiSettingsDialogOpenAtom, false);
  });

  it("opens AI settings and the text-to-diagram tab", async () => {
    let api: ExcalidrawImperativeAPI | null = null;
    const CaptureAPI = () => {
      api = useExcalidrawAPI();
      return null;
    };
    await render(
      <Provider store={appJotaiStore}>
        <Excalidraw>
          <CaptureAPI />
          <AppMainMenu
            onCollabDialogOpen={() => {}}
            onAIDiagramOpen={() => openAIDiagram(api)}
            isCollaborating={false}
            isCollabEnabled={false}
            theme="light"
            refresh={() => {}}
          />
          <AISettingsDialog />
        </Excalidraw>
      </Provider>,
    );

    fireEvent.click(screen.getByTestId("main-menu-trigger"));
    const diagramItem = screen.getByRole("menuitem", { name: "AI Diagram" });
    const settingsItem = screen.getByRole("menuitem", { name: "AI Settings" });
    expect(diagramItem).not.toBeNull();
    expect(settingsItem).not.toBeNull();

    fireEvent.click(settingsItem);
    await waitFor(() => {
      expect(appJotaiStore.get(aiSettingsDialogOpenAtom)).toBe(true);
      expect(screen.getByRole("dialog")).not.toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(appJotaiStore.get(aiSettingsDialogOpenAtom)).toBe(false),
    );
    fireEvent.click(screen.getByTestId("main-menu-trigger"));
    fireEvent.click(screen.getByRole("menuitem", { name: "AI Settings" }));
    await waitFor(() => expect(screen.getByRole("dialog")).not.toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByTestId("main-menu-trigger"));
    fireEvent.click(screen.getByRole("menuitem", { name: "AI Diagram" }));
    await waitFor(() => {
      expect(api?.getAppState().openDialog).toEqual({
        name: "ttd",
        tab: "text-to-diagram",
      });
    });
  });
});
