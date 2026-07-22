const REQUEST_ID_PATTERN = /^[a-zA-Z0-9._-]{8,100}$/;
const TRACE_ID_PATTERN = /^[0-9a-f]{32}$/i;

const parsePositiveInteger = (value, fallback, minimum, maximum) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
};

const validateOrigin = (value, name, { allowLocalHttp = false } = {}) => {
  let parsed;
  try {
    parsed = new URL(String(value || ""));
  } catch {
    throw new Error(name + " must be a valid absolute URL");
  }
  const local =
    ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname) &&
    parsed.protocol === "http:";
  if (parsed.protocol !== "https:" && !(allowLocalHttp && local)) {
    throw new Error(name + " must use HTTPS");
  }
  if (
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(name + " must be an origin without credentials or path");
  }
  return parsed.origin;
};

export const getSecuritySmokeConfiguration = (env = process.env) => {
  if (env.ALLOW_REMOTE_SECURITY_SMOKE !== "true") {
    throw new Error(
      "Set ALLOW_REMOTE_SECURITY_SMOKE=true after confirming the staging target",
    );
  }
  const baseUrl = validateOrigin(env.SECURITY_SMOKE_BASE_URL, "SECURITY_SMOKE_BASE_URL", {
    allowLocalHttp: true,
  });
  const allowedOrigin = validateOrigin(
    env.SECURITY_SMOKE_ALLOWED_ORIGIN,
    "SECURITY_SMOKE_ALLOWED_ORIGIN",
    { allowLocalHttp: true },
  );
  return {
    baseUrl,
    allowedOrigin,
    timeoutMs: parsePositiveInteger(
      env.SECURITY_SMOKE_TIMEOUT_MS,
      10_000,
      2_000,
      30_000,
    ),
  };
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const request = async (
  config,
  pathname,
  { method = "GET", headers = {} } = {},
) => {
  const response = await fetch(new URL(pathname, config.baseUrl), {
    method,
    headers,
    redirect: "manual",
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  return response;
};

const assertSecurityHeaders = (response, { https }) => {
  assert(
    response.headers.get("x-content-type-options") === "nosniff",
    "Missing X-Content-Type-Options",
  );
  assert(
    ["DENY", "SAMEORIGIN"].includes(
      response.headers.get("x-frame-options") || "",
    ),
    "Missing frame protection",
  );
  assert(!response.headers.has("x-powered-by"), "X-Powered-By must be hidden");
  if (https) {
    assert(
      response.headers.has("strict-transport-security"),
      "Missing Strict-Transport-Security",
    );
  }
  assert(
    response.headers.has("content-security-policy") ||
      response.headers.has("content-security-policy-report-only"),
    "Missing Content Security Policy",
  );
};

export const runSecuritySmoke = async (config) => {
  const results = [];
  const check = async (name, action) => {
    await action();
    results.push({ name, status: "passed" });
  };
  const https = config.baseUrl.startsWith("https://");

  await check("liveness headers", async () => {
    const response = await request(config, "/api/ops/health/live");
    assert(response.status === 200, "Liveness must return HTTP 200");
    assertSecurityHeaders(response, { https });
    assert(
      response.headers.get("cache-control") === "no-store",
      "Liveness must disable caching",
    );
    assert(
      REQUEST_ID_PATTERN.test(response.headers.get("x-request-id") || ""),
      "Missing safe request identifier",
    );
    assert(
      TRACE_ID_PATTERN.test(response.headers.get("x-trace-id") || ""),
      "Missing trace identifier",
    );
  });

  await check("database readiness", async () => {
    const response = await request(config, "/api/ops/health/ready");
    assert(response.status === 200, "Readiness must return HTTP 200");
    assert(
      response.headers.get("cache-control") === "no-store",
      "Readiness must disable caching",
    );
  });

  await check("allowed CORS origin", async () => {
    const response = await request(config, "/api/ops/health/live", {
      headers: { Origin: config.allowedOrigin },
    });
    assert(response.status === 200, "Allowed CORS request failed");
    assert(
      response.headers.get("access-control-allow-origin") ===
        config.allowedOrigin,
      "Allowed origin was not echoed exactly",
    );
    assert(
      response.headers.get("access-control-allow-credentials") === "true",
      "Credentialed CORS is not enabled",
    );
  });

  await check("denied CORS origin", async () => {
    const response = await request(config, "/api/ops/health/live", {
      headers: { Origin: "https://attacker.invalid" },
    });
    assert(response.status === 403, "Untrusted origin must return HTTP 403");
    assert(
      !response.headers.has("access-control-allow-origin"),
      "Untrusted origin received an allow-origin header",
    );
  });

  await check("operations endpoint authentication", async () => {
    const response = await request(config, "/api/ops/metrics/prometheus");
    assert(
      [401, 403].includes(response.status),
      "Metrics endpoint must reject anonymous requests",
    );
  });

  await check("private F1 legacy path", async () => {
    const response = await request(
      config,
      "/uploads/f1-media/phase10-probe.jpg",
    );
    assert(response.status === 404, "Legacy F1 media path must return 404");
  });

  await check("unknown API response", async () => {
    const response = await request(
      config,
      "/api/phase10-read-only-not-found",
    );
    assert(response.status === 404, "Unknown API path must return HTTP 404");
    assert(
      String(response.headers.get("content-type") || "").includes(
        "application/json",
      ),
      "Unknown API response must be JSON",
    );
  });

  return results;
};

const isDirectExecution =
  process.argv[1] &&
  new URL(import.meta.url).pathname
    .replace(/^\/(?:[A-Za-z]:)/, (value) => value.slice(1))
    .replaceAll("/", "\\")
    .toLowerCase() === process.argv[1].replaceAll("/", "\\").toLowerCase();

if (isDirectExecution) {
  try {
    const config = getSecuritySmokeConfiguration();
    const results = await runSecuritySmoke(config);
    process.stdout.write(
      JSON.stringify(
        {
          success: true,
          target: new URL(config.baseUrl).hostname,
          checks: results,
        },
        null,
        2,
      ) + "\n",
    );
  } catch (error) {
    process.stderr.write(
      JSON.stringify({
        success: false,
        error: error.message,
      }) + "\n",
    );
    process.exitCode = 1;
  }
}
