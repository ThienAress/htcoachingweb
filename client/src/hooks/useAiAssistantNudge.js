import { useCallback, useEffect, useMemo, useState } from "react";

import { getAiPageContext } from "../config/aiPageContext";

const SESSION_KEY = "ht-ai-nudge-shown";
const DISMISS_PREFIX = "ht-ai-nudge-dismissed:";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

export const createAiNudgeTracker = ({
  now = Date.now,
  activeThresholdMs,
  scrollThreshold,
  onReady,
}) => {
  let active = true;
  let activeTimeMs = 0;
  let lastTickAt = now();
  let maxScrollRatio = 0;
  let ready = false;

  const maybeReady = () => {
    if (
      !ready &&
      activeTimeMs >= activeThresholdMs &&
      maxScrollRatio >= scrollThreshold
    ) {
      ready = true;
      onReady();
    }
  };
  const settleTime = () => {
    const currentTime = now();
    if (active) activeTimeMs += Math.max(0, currentTime - lastTickAt);
    lastTickAt = currentTime;
  };

  return {
    recordScroll(ratio) {
      settleTime();
      maxScrollRatio = Math.max(maxScrollRatio, Math.min(Math.max(ratio, 0), 1));
      maybeReady();
    },
    setActive(nextActive) {
      settleTime();
      active = Boolean(nextActive);
      maybeReady();
    },
    tick() {
      settleTime();
      maybeReady();
    },
  };
};

const storageGet = (storage, key) => {
  try {
    return storage?.getItem(key) || null;
  } catch {
    return null;
  }
};

const storageSet = (storage, key, value) => {
  try {
    storage?.setItem(key, value);
  } catch {
    // Storage có thể bị chặn; nudge vẫn hoạt động trong lần xem hiện tại.
  }
};

export const isAiNudgeSuppressed = ({
  pathname,
  now = Date.now,
  sessionStorage,
  localStorage,
}) => {
  if (storageGet(sessionStorage, SESSION_KEY)) return true;
  const dismissedUntil = Number(
    storageGet(localStorage, `${DISMISS_PREFIX}${pathname}`),
  );
  return Number.isFinite(dismissedUntil) && dismissedUntil > now();
};

export default function useAiAssistantNudge({ pathname, enabled = true }) {
  const [nudgeState, setNudgeState] = useState(null);
  const page = useMemo(() => getAiPageContext(pathname), [pathname]);
  const config = page.proactive;
  const dismissKey = `${DISMISS_PREFIX}${pathname}`;

  useEffect(() => {
    if (!enabled || !config || typeof window === "undefined") return undefined;
    if (
      isAiNudgeSuppressed({
        pathname,
        sessionStorage: window.sessionStorage,
        localStorage: window.localStorage,
      })
    ) {
      return undefined;
    }

    const tracker = createAiNudgeTracker({
      activeThresholdMs: config.activeThresholdMs,
      scrollThreshold: config.scrollThreshold,
      onReady: () => {
        storageSet(window.sessionStorage, SESSION_KEY, "1");
        setNudgeState({ pathname, config });
      },
    });
    const isActive = () =>
      document.visibilityState === "visible" &&
      (typeof document.hasFocus !== "function" || document.hasFocus());
    const syncActive = () => tracker.setActive(isActive());
    const syncScroll = () => {
      const root = document.documentElement;
      const pageHeight = Math.max(root?.scrollHeight || 0, 1);
      const viewportBottom = (window.scrollY || 0) + (window.innerHeight || 0);
      tracker.recordScroll(Math.min(viewportBottom / pageHeight, 1));
    };
    const markInactive = () => tracker.setActive(false);

    syncActive();
    syncScroll();
    const intervalId = window.setInterval(() => tracker.tick(), 1000);
    window.addEventListener("scroll", syncScroll, { passive: true });
    window.addEventListener("focus", syncActive);
    window.addEventListener("blur", markInactive);
    window.addEventListener("pagehide", markInactive);
    document.addEventListener("visibilitychange", syncActive);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("scroll", syncScroll);
      window.removeEventListener("focus", syncActive);
      window.removeEventListener("blur", markInactive);
      window.removeEventListener("pagehide", markInactive);
      document.removeEventListener("visibilitychange", syncActive);
    };
  }, [config, dismissKey, enabled, pathname]);

  const dismiss = useCallback(() => {
    if (typeof window !== "undefined") {
      storageSet(window.localStorage, dismissKey, String(Date.now() + SNOOZE_MS));
    }
    setNudgeState(null);
  }, [dismissKey]);

  const accept = useCallback(() => setNudgeState(null), []);
  const nudge =
    enabled && nudgeState?.pathname === pathname ? nudgeState.config : null;

  return { nudge, dismiss, accept };
}
