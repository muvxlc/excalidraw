import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AI_DEFAULT_BASE_URL,
  AI_DEFAULT_MODEL,
  STORAGE_KEYS,
} from "../app_constants";
import {
  loadAISettings,
  saveAISettings,
  type AISettings,
} from "../data/AISettingsStorage";

const DEFAULT_SETTINGS: AISettings = {
  baseUrl: AI_DEFAULT_BASE_URL,
  apiKey: "",
  model: AI_DEFAULT_MODEL,
};

describe("AISettingsStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("returns defaults for empty or malformed storage", () => {
    expect(loadAISettings()).toEqual(DEFAULT_SETTINGS);
    localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_AI_SETTINGS, "{not json");
    expect(loadAISettings()).toEqual(DEFAULT_SETTINGS);
    localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_AI_SETTINGS, "[]");
    expect(loadAISettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("round-trips settings while stripping trailing slashes", () => {
    const settings = {
      baseUrl: "https://x/v1/",
      apiKey: "k",
      model: "m",
    };
    saveAISettings(settings);
    expect(loadAISettings()).toEqual({ ...settings, baseUrl: "https://x/v1" });
  });

  it.each([
    ["https://router.bangkhan.com/v1", "/api/ai"],
    ["https://router.bangkhan.com/v1///", "/api/ai"],
    ["", "/api/ai"],
    ["https://api.example.com/v2/", "https://api.example.com/v2"],
  ])("resolves stored base URL %s to %s", (baseUrl, resolved) => {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_AI_SETTINGS,
      JSON.stringify({ baseUrl, apiKey: "k", model: "m" }),
    );
    expect(loadAISettings().baseUrl).toBe(resolved);
    saveAISettings({ baseUrl, apiKey: "k", model: "m" });
    expect(
      JSON.parse(
        localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_AI_SETTINGS) ?? "null",
      ).baseUrl,
    ).toBe(resolved);
  });

  it("defaults fields with non-string stored values independently", () => {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_AI_SETTINGS,
      JSON.stringify({ baseUrl: "https://x", apiKey: 42, model: "m" }),
    );
    expect(loadAISettings()).toEqual({
      baseUrl: "https://x",
      apiKey: "",
      model: "m",
    });
  });

  it("returns defaults when localStorage getItem throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(loadAISettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("does not throw when localStorage setItem throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => saveAISettings(DEFAULT_SETTINGS)).not.toThrow();
  });
});
