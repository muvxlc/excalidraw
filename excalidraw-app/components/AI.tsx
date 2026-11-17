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
import { loadAISettings, resolveAIBaseUrl } from "../data/AISettingsStorage";

export const MERMAID_SYSTEM_PROMPT =
  'Return only Mermaid syntax, without prose or markdown fences. Use syntax supported by @excalidraw/mermaid-to-excalidraw: flowchart, sequenceDiagram, stateDiagram-v2, erDiagram, or classDiagram. ALWAYS double-quote node labels containing Thai characters or spaces (e.g. A["เริ่มต้นใช้งาน"]). Never emit click directives, style, classDef, or linkStyle directives, nested subgraphs, or HTML labels. Keep subgraphs simple and unnested.';

export type AIDiagramPreset = {
  id: string;
  testId: string;
  labelEn: string;
  labelTh: string;
  label: string;
  description: string;
  prompt: string;
};

export const AI_DIAGRAM_PRESETS: readonly AIDiagramPreset[] = [
  {
    id: "workflow",
    testId: "ai-preset-workflow",
    labelEn: "Workflow",
    labelTh: "โฟลว์เวิร์กโฟลว์",
    label: "Workflow / โฟลว์เวิร์กโฟลว์",
    description: "Flowchart of a business/approval process",
    prompt:
      "สร้างผังงาน workflow แสดงกระบวนการทำงานและขั้นตอนการอนุมัติทางธุรกิจ (Business approval workflow flowchart)",
  },
  {
    id: "flowchart",
    testId: "ai-preset-flowchart",
    labelEn: "Flowchart",
    labelTh: "ผังงาน",
    label: "Flowchart / ผังงาน",
    description: "Step-by-step decision flow",
    prompt:
      "สร้างผังงาน flowchart แสดงขั้นตอนการตัดสินใจทีละขั้นตอน (Step-by-step decision flow)",
  },
  {
    id: "sequence-diagram",
    testId: "ai-preset-sequence-diagram",
    labelEn: "Sequence Diagram",
    labelTh: "ลำดับการทำงาน",
    label: "Sequence Diagram / ลำดับการทำงาน",
    description: "Actor-to-actor message flow",
    prompt:
      "สร้าง sequence diagram แสดงลำดับการทำงานและการรับส่งข้อความระหว่าง actors (Actor-to-actor message flow sequence diagram)",
  },
  {
    id: "system-architecture",
    testId: "ai-preset-system-architecture",
    labelEn: "System Architecture",
    labelTh: "สถาปัตยกรรมระบบ",
    label: "System Architecture / สถาปัตยกรรมระบบ",
    description: "Services, DB, client",
    prompt:
      "สร้างแผนภาพสถาปัตยกรรมระบบ แสดง client, services, และ database (System architecture diagram showing client, services, and database)",
  },
  {
    id: "er-diagram",
    testId: "ai-preset-er-diagram",
    labelEn: "ER Diagram",
    labelTh: "แผนภาพความสัมพันธ์",
    label: "ER Diagram / แผนภาพความสัมพันธ์",
    description: "Entity relationship diagram",
    prompt:
      "สร้างแผนภาพความสัมพันธ์ของข้อมูล ER diagram แสดง entities, attributes, และ relationships (Entity relationship diagram)",
  },
] as const;

export const applyPresetPrompt = (prompt: string) => {
  const textarea = document.querySelector<HTMLTextAreaElement>(
    "textarea.chat-interface__input",
  );
  if (!textarea) {
    return;
  }
  const win = textarea.ownerDocument.defaultView ?? window;
  const setter = Object.getOwnPropertyDescriptor(
    win.HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  if (setter) {
    setter.call(textarea, prompt);
  } else {
    textarea.value = prompt;
  }
  textarea.dispatchEvent(new win.Event("input", { bubbles: true }));
  textarea.dispatchEvent(new win.Event("change", { bubbles: true }));
  textarea.focus();
};

export const renderAIWelcomeScreen: TTTDDialog.renderWelcomeScreen = () => {
  return (
    <div
      className="ai-welcome-screen"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        padding: "1rem",
        boxSizing: "border-box",
      }}
    >
      <TTDDialog.WelcomeMessage />
      <div
        className="ai-presets-container"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "0.5rem",
          marginTop: "1.25rem",
          width: "100%",
          maxWidth: "480px",
        }}
      >
        {AI_DIAGRAM_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`ai-preset-chip ${preset.testId}`}
            data-testid={preset.testId}
            onClick={() => applyPresetPrompt(preset.prompt)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              padding: "0.625rem 0.75rem",
              borderRadius: "var(--border-radius-md, 8px)",
              border: "1px solid var(--dialog-border-color, #e0e0e0)",
              background: "var(--color-surface-low, #f5f5f5)",
              color: "var(--color-on-surface, inherit)",
              cursor: "pointer",
              textAlign: "left",
              fontFamily: "inherit",
              lineHeight: 1.3,
            }}
          >
            <span
              className="ai-preset-chip__label"
              style={{ fontWeight: 600, fontSize: "0.85rem" }}
            >
              {preset.label}
            </span>
            <span
              className="ai-preset-chip__desc"
              style={{
                fontSize: "0.75rem",
                opacity: 0.75,
                marginTop: "0.25rem",
              }}
            >
              {preset.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

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
    content: MERMAID_SYSTEM_PROMPT,
  };

  try {
    const url = `${resolveAIBaseUrl(baseUrl)}/chat/completions`;
    const response = await fetch(url, {
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
        renderWelcomeScreen={renderAIWelcomeScreen}
        persistenceAdapter={TTDIndexedDBAdapter}
      />
    </>
  );
};
