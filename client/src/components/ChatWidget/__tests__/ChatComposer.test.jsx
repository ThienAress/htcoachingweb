import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import ChatComposer from "../ChatComposer";
import {
  CHAT_WEB_SEARCH_STORAGE_KEY,
  persistWebSearch,
  resolveInitialWebSearch,
} from "../chatPanelRuntime";

const renderComposer = (props = {}) => renderToStaticMarkup(
  <ChatComposer
    inputRef={{ current: null }}
    value=""
    onChange={vi.fn()}
    onSend={vi.fn()}
    onStop={vi.fn()}
    isLoading={false}
    selectedImage={null}
    onSelectImage={vi.fn()}
    onRemoveImage={vi.fn()}
    canAttach
    webSearchEnabled={false}
    onToggleWebSearch={vi.fn()}
    canUseWebSearch
    {...props}
  />,
);

const getButton = (html, label) =>
  html.match(new RegExp(`<button[^>]*>(?:(?!</button>).)*${label}(?:(?!</button>).)*</button>`))?.[0]
  ?? html.match(new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`))?.[0];

describe("ChatComposer", () => {
  it("puts smart search, attach and a disabled send button in one composer", () => {
    const html = renderComposer();
    expect(getButton(html, "Tìm kiếm thông minh")).toContain('aria-pressed="false"');
    expect(getButton(html, "Đính kèm ảnh")).toBeTruthy();
    expect(getButton(html, "Gửi tin nhắn")).toContain("disabled");
  });

  it("marks smart search as pressed and enables send once there is text", () => {
    const html = renderComposer({ webSearchEnabled: true, value: "Giá vàng hôm nay?" });
    expect(getButton(html, "Tìm kiếm thông minh")).toContain('aria-pressed="true"');
    expect(getButton(html, "Gửi tin nhắn")).not.toContain("disabled");
  });

  it("disables smart search and hides attach for guests", () => {
    const html = renderComposer({ canAttach: false, canUseWebSearch: false, webSearchEnabled: true });
    const toggle = getButton(html, "Tìm kiếm thông minh");
    expect(toggle).toContain("disabled");
    expect(toggle).toContain('aria-pressed="false"');
    expect(toggle).toContain("Đăng nhập để dùng Tìm kiếm thông minh");
    expect(html).not.toContain("Đính kèm ảnh");
  });

  it("turns the send button into a stop button while streaming", () => {
    const html = renderComposer({ isLoading: true });
    expect(getButton(html, "Dừng phản hồi")).not.toContain("disabled");
  });
});

describe("smart search preference storage", () => {
  const memoryStorage = () => {
    const values = new Map();
    return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  };

  it("defaults to on and remembers when the user turns it off", () => {
    const storage = memoryStorage();
    expect(resolveInitialWebSearch(storage)).toBe(true);
    persistWebSearch(false, storage);
    expect(storage.getItem(CHAT_WEB_SEARCH_STORAGE_KEY)).toBe("off");
    expect(resolveInitialWebSearch(storage)).toBe(false);
    persistWebSearch(true, storage);
    expect(resolveInitialWebSearch(storage)).toBe(true);
  });

  it("falls back to on when storage throws", () => {
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(resolveInitialWebSearch(broken)).toBe(true);
    expect(() => persistWebSearch(true, broken)).not.toThrow();
  });
});
