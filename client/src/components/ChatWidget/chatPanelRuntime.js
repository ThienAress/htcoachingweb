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

export const CHAT_WEB_SEARCH_STORAGE_KEY = "ht_chat_web_search_v1";

export const resolveInitialWebSearch = (storage) => {
  try {
    return resolveStorage(storage)?.getItem(CHAT_WEB_SEARCH_STORAGE_KEY) === "on";
  } catch {
    return false;
  }
};

export const persistWebSearch = (enabled, storage) => {
  try {
    resolveStorage(storage)?.setItem(CHAT_WEB_SEARCH_STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // Storage can be unavailable in private browsing; keep the in-memory choice.
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

const normalizeQuotaWindows = (quota) => {
  const candidates =
    Array.isArray(quota?.windows) && quota.windows.length > 0
      ? quota.windows
      : [quota];
  return candidates.filter(
    (window) =>
      Number.isSafeInteger(window?.remaining) &&
      Number.isSafeInteger(window?.limit) &&
      window.remaining >= 0 &&
      window.limit >= 1 &&
      window.remaining <= window.limit,
  );
};

// Credit tiêu được = số còn lại nhỏ nhất trong các cửa sổ (giờ/ngày/30 ngày).
const selectBindingQuotaWindow = (quota) =>
  [...normalizeQuotaWindows(quota)].sort((left, right) => {
    const remainingDifference = left.remaining - right.remaining;
    if (remainingDifference !== 0) return remainingDifference;
    return left.remaining / left.limit - right.remaining / right.limit;
  })[0];

export const LOW_CREDIT_THRESHOLD = 5;

export const getChatQuotaWindows = (quota) => normalizeQuotaWindows(quota);

export const getChatQuotaPresentation = (quota) => {
  const bindingWindow = selectBindingQuotaWindow(quota);
  const remaining = bindingWindow?.remaining;
  const limit = bindingWindow?.limit;

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
    resetAt: bindingWindow.resetAt || null,
    label: `Còn ${remaining} credit`,
    compactLabel: String(remaining),
    tone:
      remaining === 0
        ? "exhausted"
        : remaining <= LOW_CREDIT_THRESHOLD
          ? "low"
          : "normal",
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

export const formatChatQuotaReset = (value) => {
  const resetAt = new Date(value);
  if (!value || Number.isNaN(resetAt.getTime())) return "";
  const parts = Object.fromEntries(
    CHAT_QUOTA_RESET_FORMATTER.formatToParts(resetAt)
      .filter(({ type }) => type !== "literal")
      .map(({ type, value: part }) => [type, part]),
  );
  return `${parts.hour}:${parts.minute} ${parts.day}/${parts.month}`;
};

export const getChatQuotaStatusLine = (quota) => {
  const presentation = getChatQuotaPresentation(quota);
  if (!presentation) return null;
  const reset = formatChatQuotaReset(presentation.resetAt);
  return {
    label: `${presentation.label}${reset ? ` · Làm mới ${reset}` : ""}`,
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

export const getChatScrollBehavior = (
  browser = globalThis.window,
  { streaming = false } = {},
) => (streaming || prefersReducedMotion(browser) ? "auto" : "smooth");

export const isChatNearBottom = (container, thresholdPixels = 80) => {
  const scrollHeight = Number(container?.scrollHeight);
  const scrollTop = Number(container?.scrollTop);
  const clientHeight = Number(container?.clientHeight);
  if (![scrollHeight, scrollTop, clientHeight].every(Number.isFinite)) {
    return true;
  }
  const threshold = Math.min(
    Math.max(Number(thresholdPixels) || 0, 0),
    240,
  );
  return scrollHeight - scrollTop - clientHeight <= threshold;
};

export const runChatActionWithAutoFollow = (followRef, action, ...args) => {
  followRef.current = true;
  return action(...args);
};

export const getChatErrorAnnouncementProps = () => ({
  role: "alert",
  "aria-live": "assertive",
  "aria-atomic": "true",
});

export const getAssistantStreamAnnouncement = ({
  isLoading = false,
  wasLoading = false,
  terminalOutcome = null,
} = {}) => {
  if (isLoading) return "HT Assistant đang soạn câu trả lời.";
  if (wasLoading && terminalOutcome === "completed") {
    return "HT Assistant đã trả lời xong.";
  }
  return "";
};
