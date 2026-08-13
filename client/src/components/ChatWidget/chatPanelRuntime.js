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

const CHAT_QUOTA_RESET_FORMATTER = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Ho_Chi_Minh",
});

export const getChatQuotaStatusLine = (quota) => {
  const presentation = getChatQuotaPresentation(quota);
  if (!presentation) return null;

  const resetAt = new Date(quota?.resetAt);
  let resetLabel = "";
  if (!Number.isNaN(resetAt.getTime())) {
    const parts = Object.fromEntries(
      CHAT_QUOTA_RESET_FORMATTER.formatToParts(resetAt)
        .filter(({ type }) => type !== "literal")
        .map(({ type, value }) => [type, value]),
    );
    resetLabel = ` · Làm mới ${parts.hour}:${parts.minute} ${parts.day}/${parts.month}`;
  }

  return {
    label: `Còn ${presentation.remaining}/${presentation.limit} lượt${resetLabel}`,
    tone: presentation.tone,
  };
};

export const isTdeeQuickAction = (action) => action?.label === "Tính TDEE";

export const prefersReducedMotion = (browser = globalThis.window) => {
  try {
    return browser?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
  } catch {
    return false;
  }
};

export const getChatScrollBehavior = (browser = globalThis.window) =>
  prefersReducedMotion(browser) ? "auto" : "smooth";
