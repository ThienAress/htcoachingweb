import { safeLog } from './safeLogger.js';

/**
 * Triggers a Netlify build via Webhook to update the sitemap and prerendered pages.
 */
export const triggerNetlifyBuild = async () => {
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
