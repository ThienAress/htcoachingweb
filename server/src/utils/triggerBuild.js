import { safeLog } from './safeLogger.js';

/**
 * Triggers a Netlify build via Webhook to update the sitemap and prerendered pages.
 */
export const triggerNetlifyBuild = async () => {
  const buildHookUrl = process.env.NETLIFY_BUILD_HOOK_URL;
  if (!buildHookUrl) {
    safeLog.info("build_hook.skipped", { reason: "not_configured" });
    return;
  }

  try {
    await fetch(buildHookUrl, { method: 'POST' });
    safeLog.info("build_hook.triggered");
  } catch (error) {
    safeLog.error('Webhook Error', error);
  }
};
