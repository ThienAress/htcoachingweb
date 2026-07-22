const asBoundedInteger = (value, fallback, minimum, maximum) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
};

const percentile = (values, ratio) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[
    Math.min(Math.ceil(sorted.length * ratio) - 1, sorted.length - 1)
  ];
};

const baseUrl = new URL(
  process.env.LOAD_BASE_URL || "http://127.0.0.1:5000",
);
const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);
if (
  !localHosts.has(baseUrl.hostname) &&
  process.env.ALLOW_REMOTE_LOAD_SMOKE !== "true"
) {
  throw new Error(
    "Remote load smoke is disabled. Set ALLOW_REMOTE_LOAD_SMOKE=true after approval.",
  );
}

const requestCount = asBoundedInteger(
  process.env.LOAD_REQUESTS,
  30,
  1,
  500,
);
const concurrency = asBoundedInteger(
  process.env.LOAD_CONCURRENCY,
  5,
  1,
  20,
);
const timeoutMs = asBoundedInteger(
  process.env.LOAD_TIMEOUT_MS,
  5000,
  250,
  30000,
);
const maximumP95Ms = asBoundedInteger(
  process.env.LOAD_MAX_P95_MS,
  2000,
  50,
  30000,
);
const maximumErrorRate = Math.min(
  Math.max(Number(process.env.LOAD_MAX_ERROR_RATE) || 0.05, 0),
  1,
);
const endpoints = (
  process.env.LOAD_ENDPOINTS ||
  "/api/ops/health,/api/blog?limit=1,/api/recipes?limit=1"
)
  .split(",")
  .map((endpoint) => endpoint.trim())
  .filter((endpoint) => endpoint.startsWith("/"));

if (endpoints.length === 0) throw new Error("No safe GET endpoints configured");

const results = [];
let nextRequest = 0;

const runRequest = async (index) => {
  const endpoint = endpoints[index % endpoints.length];
  const target = new URL(endpoint, baseUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();
  try {
    const response = await fetch(target, {
      method: "GET",
      signal: controller.signal,
      headers: { "X-Request-Id": `load-smoke-${index}` },
    });
    await response.arrayBuffer();
    results.push({
      endpoint,
      ok: response.ok,
      status: response.status,
      durationMs: Number((performance.now() - startedAt).toFixed(2)),
    });
  } catch (error) {
    results.push({
      endpoint,
      ok: false,
      status: 0,
      error: error.name,
      durationMs: Number((performance.now() - startedAt).toFixed(2)),
    });
  } finally {
    clearTimeout(timeout);
  }
};

const worker = async () => {
  while (nextRequest < requestCount) {
    const index = nextRequest;
    nextRequest += 1;
    await runRequest(index);
  }
};

await Promise.all(
  Array.from(
    { length: Math.min(concurrency, requestCount) },
    () => worker(),
  ),
);

const durations = results.map((result) => result.durationMs);
const failures = results.filter((result) => !result.ok);
const report = {
  baseUrl: baseUrl.origin,
  requests: results.length,
  concurrency,
  failures: failures.length,
  errorRate: Number((failures.length / results.length).toFixed(4)),
  latencyMs: {
    p50: percentile(durations, 0.5),
    p95: percentile(durations, 0.95),
    max: Math.max(...durations),
  },
  statuses: Object.fromEntries(
    [...new Set(results.map((result) => result.status))].map((status) => [
      status,
      results.filter((result) => result.status === status).length,
    ]),
  ),
};

console.log(JSON.stringify(report, null, 2));
if (
  report.errorRate > maximumErrorRate ||
  report.latencyMs.p95 > maximumP95Ms
) {
  process.exitCode = 2;
}
