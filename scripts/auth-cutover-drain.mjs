import { pathToFileURL } from "node:url";

const APPROVED_ORIGINS = new Set([
  "https://htcoachingweb-staging.onrender.com",
  "https://htcoachingweb.onrender.com",
]);
const SHA_PATTERN = /^[0-9a-f]{40}$/i;
const MINIMUM_PROBE_COUNT = 3;
const MAXIMUM_PROBE_COUNT = 60;
const MINIMUM_PROBE_INTERVAL_MS = 1000;
const MAXIMUM_PROBE_INTERVAL_MS = 10000;
const MINIMUM_PROBE_WINDOW_MS = 120_000;

const parseBoundedInteger = (value, fallback, { minimum, maximum, name }) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) return fallback;
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return parsed;
};

const getVerifiedWindowMs = ({ count, intervalMs }) => {
  if (
    !Number.isSafeInteger(count) ||
    count < MINIMUM_PROBE_COUNT ||
    count > MAXIMUM_PROBE_COUNT ||
    !Number.isSafeInteger(intervalMs) ||
    intervalMs < MINIMUM_PROBE_INTERVAL_MS ||
    intervalMs > MAXIMUM_PROBE_INTERVAL_MS
  ) {
    throw new Error("Auth cutover probe count or interval is outside the bounded range");
  }

  const windowMs = (count - 1) * intervalMs;
  if (windowMs < MINIMUM_PROBE_WINDOW_MS) {
    throw new Error("Auth cutover probe window must be at least 120 seconds");
  }
  return windowMs;
};

export const resolveAuthCutoverProbeConfig = (env = process.env) => {
  const origin = new URL(String(env.AUTH_CUTOVER_PROBE_ORIGIN || ""));
  if (
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash ||
    !APPROVED_ORIGINS.has(origin.origin)
  ) {
    throw new Error("AUTH_CUTOVER_PROBE_ORIGIN is not an approved exact origin");
  }

  if (
    origin.origin === "https://htcoachingweb.onrender.com" &&
    String(env.ALLOW_PRODUCTION_AUTH_CUTOVER_PROBE || "").toLowerCase() !== "true"
  ) {
    throw new Error("Production Auth cutover probe requires explicit opt-in");
  }

  const expectedSha = String(env.AUTH_CUTOVER_EXPECTED_SHA || "").trim().toLowerCase();
  if (!SHA_PATTERN.test(expectedSha)) {
    throw new Error("AUTH_CUTOVER_EXPECTED_SHA must be an exact 40-character Git SHA");
  }

  const count = parseBoundedInteger(env.AUTH_CUTOVER_PROBE_COUNT, 25, {
    minimum: MINIMUM_PROBE_COUNT,
    maximum: MAXIMUM_PROBE_COUNT,
    name: "AUTH_CUTOVER_PROBE_COUNT",
  });
  const intervalMs = parseBoundedInteger(env.AUTH_CUTOVER_PROBE_INTERVAL_MS, 5000, {
    minimum: MINIMUM_PROBE_INTERVAL_MS,
    maximum: MAXIMUM_PROBE_INTERVAL_MS,
    name: "AUTH_CUTOVER_PROBE_INTERVAL_MS",
  });
  getVerifiedWindowMs({ count, intervalMs });

  return {
    origin: origin.origin,
    expectedSha,
    count,
    intervalMs,
  };
};

export const verifyAuthCutoverDrain = async ({
  config,
  fetchImpl = fetch,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
}) => {
  const windowMs = getVerifiedWindowMs(config);
  const endpoint = new URL("/api/auth/google", config.origin);

  for (let attempt = 1; attempt <= config.count; attempt += 1) {
    const response = await fetchImpl(endpoint, {
      method: "GET",
      redirect: "manual",
      headers: { Accept: "application/json", "Cache-Control": "no-store" },
      signal: AbortSignal.timeout(10_000),
    });
    const releaseSha = String(response.headers.get("x-ht-release-sha") || "").toLowerCase();
    const retryAfter = response.headers.get("retry-after");
    const cacheControl = response.headers.get("cache-control") || "";
    const responseBody = await response.json().catch(() => null);
    const codeMatches =
      responseBody?.code === "AUTH_CUTOVER_MAINTENANCE";

    if (
      response.status !== 503 ||
      releaseSha !== config.expectedSha ||
      retryAfter !== "60" ||
      !cacheControl.toLowerCase().includes("no-store") ||
      !codeMatches
    ) {
      throw new Error(
        `Auth drain probe failed at attempt ${attempt}: status=${response.status}, shaMatch=${releaseSha === config.expectedSha}, retryAfter=${retryAfter || "missing"}, noStore=${cacheControl.toLowerCase().includes("no-store")}, codeMatch=${codeMatches}`,
      );
    }

    if (attempt < config.count) await sleep(config.intervalMs);
  }

  return {
    verified: true,
    origin: config.origin,
    expectedSha: config.expectedSha,
    probes: config.count,
    windowSeconds: windowMs / 1000,
  };
};

const run = async () => {
  const config = resolveAuthCutoverProbeConfig();
  const result = await verifyAuthCutoverDrain({ config });
  process.stdout.write(`${JSON.stringify(result)}\n`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    process.stderr.write(`Auth cutover drain verification failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
