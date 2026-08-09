import { describe, expect, it, vi } from "vitest";
import {
  CHAT_THEME_STORAGE_KEY,
  getChatVisualViewportBounds,
  persistChatTheme,
  resolveInitialChatTheme,
} from "../chatPanelRuntime.js";

const createStorage = (entries = {}) => {
  const values = new Map(Object.entries(entries));
  return {
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, value)),
  };
};

describe("chat panel runtime", () => {
  it("defaults to light and ignores the legacy theme preference", () => {
    const storage = createStorage({ ht_chat_theme: "dark" });

    expect(resolveInitialChatTheme(storage)).toBe("light");
    expect(storage.getItem).toHaveBeenCalledWith(CHAT_THEME_STORAGE_KEY);
  });

  it("keeps an explicit valid v2 preference and persists only valid themes", () => {
    const storage = createStorage({ [CHAT_THEME_STORAGE_KEY]: "dark" });

    expect(resolveInitialChatTheme(storage)).toBe("dark");
    persistChatTheme("light", storage);
    persistChatTheme("sepia", storage);

    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(storage.setItem).toHaveBeenCalledWith(
      CHAT_THEME_STORAGE_KEY,
      "light",
    );
  });

  it("falls back to light when storage cannot be read", () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error("storage unavailable");
      }),
    };

    expect(resolveInitialChatTheme(storage)).toBe("light");
  });

  it("uses visual viewport bounds when mobile browser chrome changes", () => {
    expect(
      getChatVisualViewportBounds({
        innerHeight: 844,
        visualViewport: { offsetTop: 72.5, height: 410.25 },
      }),
    ).toEqual({ top: 72.5, height: 410.25 });
  });

  it("falls back to the layout viewport when Visual Viewport is unavailable", () => {
    expect(getChatVisualViewportBounds({ innerHeight: 844 })).toEqual({
      top: 0,
      height: 844,
    });
  });
});
