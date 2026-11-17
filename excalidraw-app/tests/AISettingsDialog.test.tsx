import { Excalidraw } from "@excalidraw/excalidraw";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@excalidraw/excalidraw/tests/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Provider, appJotaiStore } from "../app-jotai";
import { STORAGE_KEYS } from "../app_constants";
import {
  AISettingsDialog,
  aiSettingsDialogOpenAtom,
} from "../components/AISettingsDialog";

const open = () => act(() => appJotaiStore.set(aiSettingsDialogOpenAtom, true));
const input = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const click = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }));

const mount = () =>
  render(
    <Provider store={appJotaiStore}>
      <Excalidraw>
        <AISettingsDialog />
      </Excalidraw>
    </Provider>,
  );

describe("AISettingsDialog", () => {
  beforeEach(() => {
    localStorage.clear();
    appJotaiStore.set(aiSettingsDialogOpenAtom, false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens with default URL and loads model options with authentication", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ data: [{ id: "gpt-4o" }] })),
      );
    await mount();
    open();
    expect(screen.getByLabelText("Base URL")).toHaveValue(
      "https://router.bangkhan.com/v1",
    );
    input("API Key", "test-key");
    click("Load Models");
    await waitFor(() =>
      expect(document.querySelector('option[value="gpt-4o"]')).not.toBeNull(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://router.bangkhan.com/v1/models",
      expect.objectContaining({
        headers: { Authorization: "Bearer test-key" },
      }),
    );
  });

  it.each([200, 401])(
    "reports connection status for HTTP %s",
    async (status) => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ data: [] }), { status }),
      );
      await mount();
      open();
      click("Test Connection");
      await waitFor(() =>
        expect(screen.getByTestId("ai-settings-status")).toHaveTextContent(
          status === 200 ? "Connection successful" : "Error: HTTP 401",
        ),
      );
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    },
  );

  it.each(["not JSON", '{"data":null}', "{}", '{"data":[{}]}'])(
    "reports malformed response %s without closing",
    async (body) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(body));
      await mount();
      open();
      click("Load Models");
      await waitFor(() =>
        expect(screen.getByTestId("ai-settings-status")).toHaveTextContent(
          "Error:",
        ),
      );
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    },
  );

  it("saves values, reloads persisted state on reopen and discards Cancel edits", async () => {
    await mount();
    open();
    const settings = {
      baseUrl: "https://example.com/v1",
      apiKey: "saved-key",
      model: "saved-model",
    };
    input("Base URL", settings.baseUrl);
    input("API Key", settings.apiKey);
    input("Model", settings.model);
    click("Save");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      JSON.parse(
        localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_AI_SETTINGS) ?? "null",
      ),
    ).toEqual(settings);
    open();
    expect(screen.getByLabelText("Base URL")).toHaveValue(settings.baseUrl);
    expect(screen.getByLabelText("API Key")).toHaveValue(settings.apiKey);
    expect(screen.getByLabelText("Model")).toHaveValue(settings.model);
    input("Model", "discard-me");
    click("Cancel");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      JSON.parse(
        localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_AI_SETTINGS) ?? "null",
      ),
    ).toEqual(settings);
    open();
    expect(screen.getByLabelText("Model")).toHaveValue(settings.model);
  });

  it.each(["close", "unmount"])(
    "aborts a pending request on %s and ignores its late response",
    async (action) => {
      let resolveResponse: (response: Response) => void = () => {};
      const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            resolveResponse = resolve;
          }),
      );
      const view = await mount();
      open();
      click("Test Connection");
      expect(screen.getByTestId("ai-settings-status")).toHaveTextContent(
        "Loading...",
      );
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
      const signal = fetchMock.mock.calls[0]?.[1]?.signal;
      if (action === "close") {
        click("Cancel");
        open();
      } else {
        view.unmount();
      }
      expect(signal?.aborted).toBe(true);
      await act(async () => resolveResponse(new Response('{"data":[]}')));
      if (action === "close") {
        expect(screen.getByTestId("ai-settings-status")).toBeEmptyDOMElement();
      }
    },
  );
});
