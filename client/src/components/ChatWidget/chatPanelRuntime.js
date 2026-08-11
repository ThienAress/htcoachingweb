export const CHAT_THEME_STORAGE_KEY = "ht_chat_theme_v2";

const VALID_CHAT_THEMES = new Set(["light", "dark"]);

const resolveStorage = (storage) => storage ?? globalThis.localStorage;

export const resolveInitialChatTheme = (storage) => {
  try {
    const savedTheme = resolveStorage(storage)?.getItem(
      CHAT_THEME_STORAGE_KEY,
    );
    return VALID_CHAT_THEMES.has(savedTheme) ? savedTheme : "light";
  } catch {
    return "light";
  }
};

export const persistChatTheme = (theme, storage) => {
  if (!VALID_CHAT_THEMES.has(theme)) return;

  try {
    resolveStorage(storage)?.setItem(CHAT_THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be unavailable in private browsing; keep the in-memory theme.
  }
};

export const getChatVisualViewportBounds = (browser = globalThis.window) => {
  const visualViewport = browser?.visualViewport;
  const layoutHeight = Number(browser?.innerHeight);
  const viewportHeight = Number(visualViewport?.height);
  const offsetTop = Number(visualViewport?.offsetTop);

  return {
    top: Number.isFinite(offsetTop) ? Math.max(0, offsetTop) : 0,
    height: Number.isFinite(viewportHeight)
      ? Math.max(1, viewportHeight)
      : Math.max(1, Number.isFinite(layoutHeight) ? layoutHeight : 1),
  };
};

export const getChatQuotaPresentation = (quota) => {
  const remaining = quota?.remaining;
  const limit = quota?.limit;

  if (
    !Number.isSafeInteger(remaining) ||
    !Number.isSafeInteger(limit) ||
    remaining < 0 ||
    limit < 1 ||
    remaining > limit
  ) {
    return null;
  }

  return {
    remaining,
    limit,
    label: `Còn ${remaining}/${limit} lượt hỏi`,
    compactLabel: `${remaining}/${limit}`,
    tone: remaining === 0 ? "exhausted" : remaining <= 2 ? "low" : "normal",
  };
};

export const prefersReducedMotion = (browser = globalThis.window) => {
  try {
    return browser?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
  } catch {
    return false;
  }
};

export const getChatScrollBehavior = (browser = globalThis.window) =>
  prefersReducedMotion(browser) ? "auto" : "smooth";
