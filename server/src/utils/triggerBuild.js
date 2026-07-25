import { safeLog } from './safeLogger.js';

export const NETLIFY_BUILD_BATCH_WINDOW_MS = 15 * 60 * 1000;

let scheduledBuildTimer = null;
const scheduledBuildReasons = new Set();

const cancelScheduledBuild = () => {
  if (!scheduledBuildTimer) return;
  clearTimeout(scheduledBuildTimer);
  scheduledBuildTimer = null;
  scheduledBuildReasons.clear();
};

/**
 * Triggers a Netlify build via Webhook to update the sitemap and prerendered pages.
 */
export const triggerNetlifyBuild = async () => {
  cancelScheduledBuild();
  const buildHookUrl = process.env.NETLIFY_BUILD_HOOK_URL;
  if (!buildHookUrl) {
    safeLog.info("build_hook.skipped", { reason: "not_configured" });
    return { triggered: false, reason: "not_configured" };
  }

  try {
    const response = await fetch(buildHookUrl, {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Netlify build hook returned HTTP ${response.status}`);
    }
    safeLog.info("build_hook.triggered", { status: response.status });
    return { triggered: true, status: response.status };
  } catch (error) {
    safeLog.error("build_hook.failed", error);
    return { triggered: false, reason: "request_failed" };
  }
};

export const scheduleNetlifyBuild = (reason = "content_changed") => {
  if (!process.env.NETLIFY_BUILD_HOOK_URL) {
    safeLog.info("build_hook.schedule_skipped", { reason: "not_configured" });
    return { scheduled: false, reason: "not_configured" };
  }

  const normalizedReason =
    String(reason || "content_changed").trim().slice(0, 80) ||
    "content_changed";
  scheduledBuildReasons.add(normalizedReason);

  if (scheduledBuildTimer) {
    safeLog.info("build_hook.coalesced", {
      reason: normalizedReason,
      delayMs: NETLIFY_BUILD_BATCH_WINDOW_MS,
    });
    return {
      scheduled: true,
      coalesced: true,
      delayMs: NETLIFY_BUILD_BATCH_WINDOW_MS,
    };
  }

  scheduledBuildTimer = setTimeout(() => {
    const reasons = [...scheduledBuildReasons];
    scheduledBuildTimer = null;
    scheduledBuildReasons.clear();
    safeLog.info("build_hook.batch_started", { reasons });
    void triggerNetlifyBuild();
  }, NETLIFY_BUILD_BATCH_WINDOW_MS);
  scheduledBuildTimer.unref?.();

  safeLog.info("build_hook.scheduled", {
    reason: normalizedReason,
    delayMs: NETLIFY_BUILD_BATCH_WINDOW_MS,
  });
  return {
    scheduled: true,
    coalesced: false,
    delayMs: NETLIFY_BUILD_BATCH_WINDOW_MS,
  };
};
