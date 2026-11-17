import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import Stack from "@excalidraw/excalidraw/components/Stack";
import { useEffect, useId, useRef, useState } from "react";

import "@excalidraw/excalidraw/components/TextField.scss";

import { atom, useAtom } from "../app-jotai";
import { AI_DEFAULT_BASE_URL } from "../app_constants";
import {
  loadAISettings,
  resolveAIBaseUrl,
  saveAISettings,
} from "../data/AISettingsStorage";

export const aiSettingsDialogOpenAtom = atom(false);

export const AISettingsDialog = () => {
  const [isOpen, setIsOpen] = useAtom(aiSettingsDialogOpenAtom);
  const [settings, setSettings] = useState(loadAISettings);
  const [models, setModels] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const request = useRef<AbortController | null>(null);
  const modelListId = useId();
  const baseUrl = resolveAIBaseUrl(settings.baseUrl);
  const isProxy = baseUrl === AI_DEFAULT_BASE_URL;

  useEffect(() => {
    if (isOpen) {
      setSettings(loadAISettings());
      setModels([]);
      setStatus("");
      setIsLoading(false);
    }
    return () => request.current?.abort();
  }, [isOpen]);

  const close = () => {
    request.current?.abort();
    setIsOpen(false);
  };

  const probe = async (loadModels: boolean) => {
    if (!isOpen) {
      return;
    }
    if (!isProxy && !settings.apiKey.trim()) {
      setStatus("Error: API Key is required for custom Base URLs");
      return;
    }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setIsLoading(true);
    setStatus("Loading...");
    try {
      const response = await fetch(`${baseUrl}/models`, {
        headers: isProxy ? {} : { Authorization: `Bearer ${settings.apiKey}` },
        signal: controller.signal,
      });
      if (controller.signal.aborted) {
        return;
      }
      if (!response.ok) {
        setStatus(`Error: HTTP ${response.status}`);
        return;
      }
      const body: unknown = await response.json();
      if (controller.signal.aborted) {
        return;
      }
      if (
        !body ||
        typeof body !== "object" ||
        !("data" in body) ||
        !Array.isArray(body.data) ||
        !body.data.every(
          (item: unknown) =>
            !!item &&
            typeof item === "object" &&
            "id" in item &&
            typeof item.id === "string",
        )
      ) {
        setStatus("Error: Invalid models response");
        return;
      }
      if (loadModels) {
        setModels(body.data.map((item: { id: string }) => item.id));
      }
      setStatus(
        loadModels ? "Models loaded successfully" : "Connection successful",
      );
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error("AI settings models request failed", error);
        setStatus(
          `Error: ${error instanceof Error ? error.message : "Request failed"}`,
        );
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog title="AI Settings" size="small" onCloseRequest={close}>
      <Stack.Col gap={4}>
        {(["baseUrl", "apiKey", "model"] as const).map((field) => (
          <label className="ExcTextField ExcTextField--fullWidth" key={field}>
            <div className="ExcTextField__label">
              {
                {
                  baseUrl: "Base URL",
                  apiKey: isProxy ? "API Key (optional)" : "API Key",
                  model: "Model",
                }[field]
              }
            </div>
            <div className="ExcTextField__input">
              <input
                type={field === "apiKey" ? "password" : "text"}
                value={settings[field]}
                placeholder={
                  field === "apiKey" && isProxy
                    ? "ใช้ key จาก server (ไม่ต้องกรอก)"
                    : undefined
                }
                list={field === "model" ? modelListId : undefined}
                onChange={(event) =>
                  setSettings({ ...settings, [field]: event.target.value })
                }
              />
            </div>
          </label>
        ))}
        <datalist id={modelListId}>
          {models.map((model) => (
            <option key={model} value={model} />
          ))}
        </datalist>
        <FilledButton
          variant="outlined"
          label="Load Models"
          disabled={isLoading}
          onClick={() => void probe(true)}
        />
        <FilledButton
          variant="outlined"
          label="Test Connection"
          disabled={isLoading}
          onClick={() => void probe(false)}
        />
        <div role="status" data-testid="ai-settings-status">
          {status}
        </div>
        <FilledButton
          label="Save"
          onClick={() => {
            saveAISettings(settings);
            close();
          }}
        />
        <FilledButton variant="outlined" label="Cancel" onClick={close} />
      </Stack.Col>
    </Dialog>
  );
};
