// Đánh thức backend trước khi sitemap/prerender gọi API.
//
// Backend staging (Render) ngủ khi không có truy cập; lần gọi đầu mất ~1 phút,
// quá timeout 10–30 giây của bước build nên sitemap/prerender thấy mọi request
// bị ECONNABORTED và kiểm tra cohort công thức nấu ăn báo lỗi. Script này gọi
// một endpoint công khai, chờ tới khi backend trả lời (hoặc hết thời gian chờ).
//
// Không bao giờ làm hỏng build: không đạt được thì chỉ cảnh báo, để các bước sau
// tự áp dụng chính sách strict/fallback hiện có.
import axios from "axios";
import { pathToFileURL } from "node:url";
import {
  normalizeDynamicRouteApiUrl,
  resolveDynamicRoutePolicy,
} from "./dynamic-routes.js";

export const WARM_UP_PATH = "/recipes?limit=1";
const DEFAULT_TOTAL_MS = 150_000;
const DEFAULT_REQUEST_MS = 60_000;
const DEFAULT_PAUSE_MS = 5_000;

const positiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const collectApiUrls = (env, policy, logger) => {
  const candidates = [
    env.SITEMAP_API_URL || env.VITE_API_URL,
    env.PRERENDER_API_URL || env.VITE_API_URL,
  ].filter(Boolean);
  const urls = new Set();
  for (const candidate of candidates) {
    try {
      urls.add(normalizeDynamicRouteApiUrl(candidate, policy));
    } catch (error) {
      logger.warn(`Warm-up skipped an unusable API URL: ${error.message}`);
    }
  }
  return [...urls];
};

export const warmUpApi = async ({
  env = process.env,
  fetchApi = (url, timeout) => axios.get(url, { timeout }),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = Date.now,
  logger = console,
} = {}) => {
  let policy;
  try {
    policy = resolveDynamicRoutePolicy(env);
  } catch (error) {
    logger.warn(`Warm-up skipped: ${error.message}`);
    return { status: "skipped", reason: "policy" };
  }
  if (policy.skip) return { status: "skipped", reason: "static-only" };

  const urls = collectApiUrls(env, policy, logger);
  if (urls.length === 0) return { status: "skipped", reason: "no-api-url" };

  const totalMs = positiveNumber(env.WARMUP_API_TOTAL_MS, DEFAULT_TOTAL_MS);
  const requestMs = positiveNumber(env.WARMUP_API_REQUEST_MS, DEFAULT_REQUEST_MS);
  const pauseMs = positiveNumber(env.WARMUP_API_PAUSE_MS, DEFAULT_PAUSE_MS);
  const results = [];

  for (const apiUrl of urls) {
    const startedAt = now();
    let attempts = 0;
    let ready = false;

    while (!ready) {
      attempts += 1;
      try {
        await fetchApi(apiUrl + WARM_UP_PATH, requestMs);
        ready = true;
      } catch (error) {
        const elapsed = now() - startedAt;
        if (elapsed + pauseMs >= totalMs) {
          logger.warn(
            `API did not respond after ${attempts} attempt(s) in ${Math.round(
              elapsed / 1000,
            )}s: ${error.message}`,
          );
          break;
        }
        await sleep(pauseMs);
      }
    }

    if (ready) {
      logger.log(
        `API is awake (${attempts} attempt(s), ${Math.round(
          (now() - startedAt) / 1000,
        )}s)`,
      );
    }
    results.push({ apiUrl, ready, attempts });
  }

  return {
    status: results.every((item) => item.ready) ? "ready" : "unreachable",
    results,
  };
};

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  try {
    await warmUpApi();
  } catch (error) {
    console.warn(`Warm-up failed unexpectedly: ${error.message}`);
  }
}
