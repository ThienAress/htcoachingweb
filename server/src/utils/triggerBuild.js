import axios from 'axios';
import { safeLog } from './safeLogger.js';

/**
 * Triggers a Netlify build via Webhook to update the sitemap and prerendered pages.
 */
export const triggerNetlifyBuild = async () => {
  const buildHookUrl = process.env.NETLIFY_BUILD_HOOK_URL;
  if (!buildHookUrl) {
    console.log('[Webhook] NETLIFY_BUILD_HOOK_URL is not configured, skipping build trigger.');
    return;
  }

  try {
    await axios.post(buildHookUrl, {});
    console.log('[Webhook] Netlify build triggered successfully.');
  } catch (error) {
    safeLog.error('Webhook Error', error);
  }
};
