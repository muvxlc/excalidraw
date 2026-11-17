import {
  DiagramToCodePlugin,
  exportScene,
  getNonDeletedElements,
  getTextFromElements,
  parseSSEStream,
  TTDDialog,
  THEME,
} from "@excalidraw/excalidraw";
import { getDataURL } from "@excalidraw/excalidraw/data/blob";
import { safelyParseJSON } from "@excalidraw/common";
import { RequestError } from "@excalidraw/excalidraw/errors";

import type { StreamChunk } from "@excalidraw/excalidraw";
import type { TTTDDialog } from "@excalidraw/excalidraw/components/TTDDialog/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { TTDIndexedDBAdapter } from "../data/TTDStorage";
import { loadAISettings } from "../data/AISettingsStorage";

export const submitAIPrompt = async ({
  onChunk,
  onStreamCreated,
  signal,
  messages,
}: TTTDDialog.OnTextSubmitProps): Promise<TTTDDialog.OnTextSubmitRetValue> => {
  const { baseUrl, apiKey, model } = loadAISettings();
  if (!apiKey.trim() || !model.trim()) {
    return {
      error: new RequestError({
        message:
          "กรุณาตั้งค่า AI Settings (Base URL, API Key, Model) ก่อนใช้งาน",
        status: 400,
      }),
      generatedResponse: null,
    };
  }

  const systemMessage = {
    role: "system",
    content:
      'Return only Mermaid syntax, without prose or markdown fences. Use syntax supported by @excalidraw/mermaid-to-excalidraw: flowchart, sequenceDiagram, stateDiagram-v2, erDiagram, or classDiagram. Double-quote Thai labels inside node brackets, for example A["เริ่มต้นใช้งาน"]. Never emit click directives, custom style or classDef directives, or nested subgraphs. Keep subgraphs simple and unnested.',
  };

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [systemMessage, ...messages],
        stream: true,
      }),
      signal,
    });

    if (!response.ok) {
      const text = await response.text();
      const parsed: unknown = safelyParseJSON(text);
      const serverError =
        parsed && typeof parsed === "object" && "error" in parsed
          ? parsed.error
          : parsed;
      const message =
        serverError &&
        typeof serverError === "object" &&
        "message" in serverError &&
        typeof serverError.message === "string"
          ? serverError.message
          : `AI request failed (HTTP ${response.status})`;
      return {
        error: new RequestError({
          message,
          status: response.status,
          data: parsed ?? text,
        }),
        generatedResponse: null,
      };
    }

    const reader = response.body?.getReader();
    let fullText = "";
    if (reader) {
      try {
        for await (const data of parseSSEStream(reader)) {
          if (!data.trim()) {
            continue;
          }
          if (data === "[DONE]") {
            break;
          }
          const chunk: unknown = safelyParseJSON(data);
          const choice: unknown =
            chunk &&
            typeof chunk === "object" &&
            "choices" in chunk &&
            Array.isArray(chunk.choices)
              ? chunk.choices[0]
              : null;
          const content =
            choice && typeof choice === "object" && "delta" in choice
              ? choice.delta
              : null;
          const delta =
            content && typeof content === "object" && "content" in content
              ? content.content
              : null;
          if (typeof delta !== "string" || !delta) {
            continue;
          }
          if (!fullText) {
            onStreamCreated?.();
          }
          fullText += delta;
          onChunk?.(delta);
        }
      } finally {
        // parseSSEStream releases the reader, including on early exit.
        // Cancel the unlocked body to stop upstream work after [DONE].
        await response.body?.cancel().catch(() => undefined);
        reader.releaseLock();
      }
    }

    return fullText.trim()
      ? { generatedResponse: fullText, error: null }
      : {
          error: new RequestError({
            message: "AI returned an empty response",
            status: 500,
          }),
          generatedResponse: null,
        };
  } catch (error) {
    const aborted =
      (error instanceof Error || error instanceof DOMException) &&
      error.name === "AbortError";
    return {
      error: new RequestError({
        message: aborted
          ? "AI request cancelled"
          : error instanceof Error
          ? error.message
          : "AI request failed",
        status: aborted ? 499 : 500,
      }),
      generatedResponse: null,
    };
  }
};

export const AIComponents = ({
  excalidrawAPI,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI;
}) => {
  return (
    <>
      <DiagramToCodePlugin
        generate={async ({ frame, children, onPartial }) => {
          const appState = excalidrawAPI.getAppState();

          // SAFETY: This should never happen, but log it just in case
          if (children.some((el) => el.isDeleted)) {
            console.error(
              "[NONDELETED][INVARIANT] Generated children elements should not be `isDeleted: true`",
            );
          }

          const blob = await exportScene({
            type: "jpeg",
            data: {
              elements: getNonDeletedElements(children),
              appState,
              files: excalidrawAPI.getFiles(),
            },
            config: {
              exportingFrame: frame,
              theme: appState.exportWithDarkMode ? THEME.DARK : THEME.LIGHT,
            },
          });

          const dataURL = await getDataURL(blob);

          const textFromFrameChildren = getTextFromElements(children);

          const response = await fetch(
            `${
              import.meta.env.VITE_APP_AI_BACKEND
            }/v1/ai/diagram-to-code/generate-streaming`,
            {
              method: "POST",
              headers: {
                Accept: "text/event-stream",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                texts: textFromFrameChildren,
                image: dataURL,
                theme: appState.theme,
              }),
            },
          );

          if (!response.ok) {
            const text = await response.text();
            const errorJSON = safelyParseJSON(text);

            if (!errorJSON) {
              throw new Error(text);
            }

            if (errorJSON.statusCode === 429) {
              return {
                html: `<html>
                <body style="margin: 0; text-align: center">
                <div style="display: flex; align-items: center; justify-content: center; flex-direction: column; height: 100vh; padding: 0 60px">
                  <div style="color:red">Too many requests today,</br>please try again tomorrow!</div>
                  </br>
                  </br>
                  <div>You can also try <a href="${
                    import.meta.env.VITE_APP_PLUS_LP
                  }/plus?utm_source=excalidraw&utm_medium=app&utm_content=d2c" target="_blank" rel="noopener">Excalidraw+</a> to get more requests.</div>
                </div>
                </body>
                </html>`,
              };
            }

            throw new Error(errorJSON.message || text);
          }

          const reader = response.body?.getReader();

          if (!reader) {
            throw new Error("Generation failed (invalid response)");
          }

          let html = "";
          let streamError: Error | null = null;

          for await (const data of parseSSEStream(reader)) {
            if (data === "[DONE]") {
              break;
            }

            const chunk = safelyParseJSON(data) as StreamChunk | null;

            if (!chunk) {
              continue;
            }

            switch (chunk.type) {
              case "content": {
                if (chunk.delta) {
                  html += chunk.delta;
                  onPartial?.(html);
                }
                break;
              }
              case "error": {
                streamError = new Error(
                  chunk.error.message || "Generation failed",
                );
                break;
              }
              case "done": {
                break;
              }
            }
          }

          if (streamError) {
            throw streamError;
          }

          if (!html.trim()) {
            throw new Error("Generation failed (invalid response)");
          }

          return {
            html,
          };
        }}
      />

      <TTDDialog
        onTextSubmit={submitAIPrompt}
        persistenceAdapter={TTDIndexedDBAdapter}
      />
    </>
  );
};
