import { safelyParseJSON } from "@excalidraw/common";

import {
  AI_DEFAULT_BASE_URL,
  AI_DEFAULT_MODEL,
  STORAGE_KEYS,
} from "../app_constants";

export type AISettings = { baseUrl: string; apiKey: string; model: string };

const DEFAULT_SETTINGS: AISettings = {
  baseUrl: AI_DEFAULT_BASE_URL,
  apiKey: "",
  model: AI_DEFAULT_MODEL,
};

const normalizeBaseUrl = (baseUrl: string) =>
  baseUrl.replace(/\/+$/, "") || AI_DEFAULT_BASE_URL;

export const loadAISettings = (): AISettings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_AI_SETTINGS);
    const parsed = stored ? safelyParseJSON(stored) : null;
    const settings = {
      baseUrl:
        typeof parsed?.baseUrl === "string"
          ? parsed.baseUrl
          : DEFAULT_SETTINGS.baseUrl,
      apiKey:
        typeof parsed?.apiKey === "string"
          ? parsed.apiKey
          : DEFAULT_SETTINGS.apiKey,
      model:
        typeof parsed?.model === "string"
          ? parsed.model
          : DEFAULT_SETTINGS.model,
    };
    return { ...settings, baseUrl: normalizeBaseUrl(settings.baseUrl) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
};

export const saveAISettings = (settings: AISettings): void => {
  try {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_AI_SETTINGS,
      JSON.stringify({
        ...settings,
        baseUrl: normalizeBaseUrl(settings.baseUrl),
      }),
    );
  } catch {
    // Storage may be unavailable or blocked.
  }
};
