import { describe, expect, it, vi } from "vitest";
import {
  CHAT_THEME_STORAGE_KEY,
  getChatVisualViewportBounds,
  getChatQuotaPresentation,
  getChatQuotaStatusLine,
  getChatScrollBehavior,
  isTdeeQuickAction,
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

  it("presents a server quota with normal emphasis", () => {
    expect(getChatQuotaPresentation({ remaining: 4, limit: 5 })).toEqual({
      remaining: 4,
      limit: 5,
      label: "Còn 4/5 lượt hỏi",
      compactLabel: "4/5",
      tone: "normal",
    });
  });

  it("warns when only two quota messages remain", () => {
    expect(getChatQuotaPresentation({ remaining: 2, limit: 15 })).toEqual({
      remaining: 2,
      limit: 15,
      label: "Còn 2/15 lượt hỏi",
      compactLabel: "2/15",
      tone: "low",
    });
  });

  it("marks an exhausted quota without deriving a client-side limit", () => {
    expect(getChatQuotaPresentation({ remaining: 0, limit: 30 })).toEqual({
      remaining: 0,
      limit: 30,
      label: "Còn 0/30 lượt hỏi",
      compactLabel: "0/30",
      tone: "exhausted",
    });
  });

  it("hides quota presentation when server metadata is incomplete", () => {
    expect(getChatQuotaPresentation({ remaining: 4 })).toBeNull();
  });

  it("formats quota and reset time as one compact line below the composer", () => {
    expect(
      getChatQuotaStatusLine({
        remaining: 22,
        limit: 30,
        resetAt: "2026-08-12T13:42:00.000Z",
      }),
    ).toEqual({
      label: "Còn 22/30 lượt · Làm mới 20:42 12/08",
      tone: "normal",
    });
  });

  it("opens the TDEE form only for the calculate quick action", () => {
    expect([
      isTdeeQuickAction({
        label: "Tính TDEE",
        value: "Tính TDEE và macro cho tôi",
      }),
      isTdeeQuickAction({
        label: "Hiểu kết quả",
        value: "Giải thích cách đọc và áp dụng kết quả TDEE",
      }),
    ]).toEqual([true, false]);
  });

  it("uses instant scrolling when reduced motion is requested", () => {
    expect(
      getChatScrollBehavior({
        matchMedia: vi.fn(() => ({ matches: true })),
      }),
    ).toBe("auto");
    expect(
      getChatScrollBehavior({
        matchMedia: vi.fn(() => ({ matches: false })),
      }),
    ).toBe("smooth");
  });
});
