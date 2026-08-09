import { useEffect } from "react";

import {
  trackAnalyticsEventOnce,
} from "../utils/analytics";
import { rememberPublicContent } from "../utils/publicAttribution";

const ACTIVE_THRESHOLD_MS = 30_000;
const SCROLL_THRESHOLD = 0.5;

export const createBlogEngagementTracker = ({
  now = Date.now,
  track,
  activeThresholdMs = ACTIVE_THRESHOLD_MS,
  scrollThreshold = SCROLL_THRESHOLD,
}) => {
  let active = true;
  let activeTimeMs = 0;
  let lastTickAt = now();
  let maxScrollRatio = 0;
  let tracked = false;

  const maybeTrack = () => {
    if (
      !tracked &&
      activeTimeMs >= activeThresholdMs &&
      maxScrollRatio >= scrollThreshold
    ) {
      tracked = true;
      track();
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
      maybeTrack();
    },
    setActive(nextActive) {
      settleTime();
      active = Boolean(nextActive);
      maybeTrack();
    },
    tick() {
      settleTime();
      maybeTrack();
    },
  };
};

export const startBlogEngagementTracking = ({
  slug,
  category,
  language,
  windowObject = typeof window !== "undefined" ? window : null,
  documentObject = typeof document !== "undefined" ? document : null,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  track = (params) =>
    trackAnalyticsEventOnce(
      "blog_read_engaged",
      `blog:${slug}`,
      params,
    ),
  rememberContent = rememberPublicContent,
}) => {
  if (!slug || !windowObject || !documentObject) return () => {};

  rememberContent({ contentType: "blog", contentSlug: slug });
  const tracker = createBlogEngagementTracker({
    track: () =>
      track({
        content_type: "blog",
        content_slug: slug,
        content_category: category,
        language,
      }),
  });

  const isActive = () =>
    documentObject.visibilityState === "visible" &&
    (typeof documentObject.hasFocus !== "function" || documentObject.hasFocus());
  const syncActive = () => tracker.setActive(isActive());
  const syncScroll = () => {
    const pageHeight = Math.max(documentObject.documentElement?.scrollHeight || 0, 1);
    const viewportBottom = (windowObject.scrollY || 0) + (windowObject.innerHeight || 0);
    tracker.recordScroll(viewportBottom / pageHeight);
  };
  const markInactive = () => tracker.setActive(false);

  syncActive();
  syncScroll();
  const intervalId = setIntervalFn(() => tracker.tick(), 1_000);
  windowObject.addEventListener("scroll", syncScroll, { passive: true });
  windowObject.addEventListener("focus", syncActive);
  windowObject.addEventListener("blur", markInactive);
  windowObject.addEventListener("pagehide", markInactive);
  documentObject.addEventListener("visibilitychange", syncActive);

  return () => {
    clearIntervalFn(intervalId);
    windowObject.removeEventListener("scroll", syncScroll);
    windowObject.removeEventListener("focus", syncActive);
    windowObject.removeEventListener("blur", markInactive);
    windowObject.removeEventListener("pagehide", markInactive);
    documentObject.removeEventListener("visibilitychange", syncActive);
  };
};

const useBlogEngagement = ({ slug, category, language }) => {
  useEffect(
    () => startBlogEngagementTracking({ slug, category, language }),
    [slug, category, language],
  );
};

export default useBlogEngagement;
