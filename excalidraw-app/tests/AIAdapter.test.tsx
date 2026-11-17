import { useState } from "react";
import { vi } from "vitest";

import { Excalidraw } from "@excalidraw/excalidraw";
import { RequestError } from "@excalidraw/excalidraw/errors";
import {
  fireEvent,
  render,
  waitFor,
} from "@excalidraw/excalidraw/tests/test-utils";
import { UI } from "@excalidraw/excalidraw/tests/helpers/ui";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { AIComponents, submitAIPrompt } from "../components/AI";
import { STORAGE_KEYS } from "../app_constants";
import { Provider } from "../app-jotai";

const deltas = ["flowchart TD\n", 'A["Start"] --> B["End"]'];
const messages = [{ role: "user", content: "Draw a simple workflow" }] as const;
const scrollDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "scrollIntoView",
);
const bboxDescriptor = Object.getOwnPropertyDescriptor(
  SVGElement.prototype,
  "getBBox",
);
const saveSettings = (model = "test-model", apiKey = "test-key") => {
  localStorage.setItem(
    STORAGE_KEYS.LOCAL_STORAGE_AI_SETTINGS,
    JSON.stringify({ baseUrl: "https://router.test/v1", apiKey, model }),
  );
};
const sseResponse = (
  lines = deltas.map((content) =>
    JSON.stringify({ choices: [{ delta: { content } }] }),
  ),
) => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of [...lines, "[DONE]"]) {
        controller.enqueue(new TextEncoder().encode(`data: ${line}\n\n`));
      }
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
};
const submit = (props = {}) =>
  submitAIPrompt({ messages: [...messages], ...props });

beforeEach(() => saveSettings());
afterEach(() => {
  vi.restoreAllMocks();
  if (scrollDescriptor) {
    Object.defineProperty(
      HTMLElement.prototype,
      "scrollIntoView",
      scrollDescriptor,
    );
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  }
  if (bboxDescriptor) {
    Object.defineProperty(SVGElement.prototype, "getBBox", bboxDescriptor);
  } else {
    Reflect.deleteProperty(SVGElement.prototype, "getBBox");
  }
  localStorage.removeItem(STORAGE_KEYS.LOCAL_STORAGE_AI_SETTINGS);
});

it("rejects missing credentials before fetching", async () => {
  saveSettings("", "");
  const fetch = vi.spyOn(globalThis, "fetch");
  const result = await submit();
  expect(fetch).not.toHaveBeenCalled();
  expect(result.error).toBeInstanceOf(RequestError);
  expect(result.error?.status).toBe(400);
  expect(result.error?.message).toBe(
    "กรุณาตั้งค่า AI Settings (Base URL, API Key, Model) ก่อนใช้งาน",
  );
  expect(result.generatedResponse).toBeNull();
});

it("streams OpenAI deltas in order and authenticates the configured model", async () => {
  const response = sseResponse();
  const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(response);
  const onStreamCreated = vi.fn();
  const onChunk = vi.fn();
  const result = await submit({ onStreamCreated, onChunk });
  expect(onStreamCreated).toHaveBeenCalledTimes(1);
  expect(onChunk.mock.calls).toEqual(deltas.map((delta) => [delta]));
  expect(result).toEqual({ generatedResponse: deltas.join(""), error: null });
  expect(response.body?.locked).toBe(false);
  expect(fetch).toHaveBeenCalledWith(
    "https://router.test/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-key",
      },
      body: expect.any(String),
      signal: undefined,
    },
  );
  const body = fetch.mock.calls[0]?.[1]?.body;
  expect(typeof body).toBe("string");
  if (typeof body !== "string") {
    throw new Error("Missing JSON request body");
  }
  expect(JSON.parse(body)).toEqual({
    model: "test-model",
    stream: true,
    messages: [{ role: "system", content: expect.any(String) }, ...messages],
  });
});

it.each([401, 500])("returns structured HTTP %s errors", async (status) => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response('{"error":{"message":"bad key"}}', { status }),
  );
  const result = await submit();
  expect(result.error).toBeInstanceOf(RequestError);
  expect(result.error?.status).toBe(status);
  expect(result.error?.message).toContain("bad key");
  expect(result.error?.data).toEqual({ error: { message: "bad key" } });
  expect(result.generatedResponse).toBeNull();
});

it("retains non-JSON error bodies with an HTTP fallback message", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("proxy down", { status: 502 }),
  );
  const result = await submit();
  expect(result.error?.status).toBe(502);
  expect(result.error?.message).toBe("AI request failed (HTTP 502)");
  expect(result.error?.data).toBe("proxy down");
});

it("returns 499 when fetch is aborted", async () => {
  vi.spyOn(globalThis, "fetch").mockRejectedValue(
    new DOMException("Aborted", "AbortError"),
  );
  const result = await submit();
  expect(result.error?.status).toBe(499);
  expect(result.error?.message).toBe("AI request cancelled");
});

it("releases an aborted stream reader and permits a fresh submission", async () => {
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.error(new DOMException("Aborted", "AbortError"));
    },
  });
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(body))
    .mockResolvedValueOnce(sseResponse());
  expect((await submit()).error?.status).toBe(499);
  expect(body.locked).toBe(false);
  expect((await submit()).generatedResponse).toBe(deltas.join(""));
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("ignores malformed or metadata chunks without losing later content", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    sseResponse([
      "not JSON",
      "{}",
      "null",
      '{"choices":[{"delta":{"role":"assistant"}}]}',
      ...deltas.map((content) =>
        JSON.stringify({ choices: [{ delta: { content } }] }),
      ),
    ]),
  );
  expect((await submit()).generatedResponse).toBe(deltas.join(""));
});

it("rejects empty streams instead of reporting success", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(sseResponse([]));
  const onStreamCreated = vi.fn();
  const result = await submit({ onStreamCreated });
  expect(result.error?.status).toBe(500);
  expect(result.error?.message).toBe("AI returned an empty response");
  expect(result.generatedResponse).toBeNull();
  expect(onStreamCreated).not.toHaveBeenCalled();
});

it("reads settings fresh for each submission", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () => sseResponse());
  await submit();
  saveSettings("new-model");
  await submit();
  expect(fetch.mock.calls[1]?.[1]?.body).toContain('"model":"new-model"');
});

it("shows streamed Mermaid in the dialog and inserts generated elements", async () => {
  Object.defineProperty(SVGElement.prototype, "getBBox", {
    configurable: true,
    value: () => ({ x: 0, y: 0, width: 80, height: 20 }),
  });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => sseResponse());
  const App = () => {
    const [api, setAPI] = useState<ExcalidrawImperativeAPI | null>(null);
    return (
      <Provider>
        <Excalidraw
          onExcalidrawAPI={setAPI}
          initialData={{
            appState: {
              openDialog: { name: "ttd", tab: "text-to-diagram" },
            },
          }}
        >
          {api && <AIComponents excalidrawAPI={api} />}
        </Excalidraw>
      </Provider>
    );
  };
  const view = await render(<App />);
  const input = await view.findByRole("textbox");
  fireEvent.change(input, { target: { value: "Draw a simple workflow" } });
  fireEvent.keyDown(input, { key: "Enter" });
  await waitFor(() =>
    expect(
      document.querySelector(".chat-message--assistant .chat-message__text")
        ?.textContent,
    ).toBe(deltas.join("")),
  );
  await waitFor(() =>
    expect(
      document.querySelector(".ttd-dialog-preview-panel canvas"),
    ).not.toBeNull(),
  );
  UI.clickByTitle("Insert");
  await waitFor(() => {
    expect(window.h.elements.map((element) => element.type)).toEqual(
      expect.arrayContaining(["rectangle", "arrow"]),
    );
  });
});
