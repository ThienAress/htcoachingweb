export const CANONICAL_CLIENT_ORIGIN = "https://htcoachingweb.io.vn";
export const PRODUCTION_API_ORIGIN = "https://htcoachingweb.onrender.com";

const APPROVED_CLIENT_ORIGINS = new Set([
  CANONICAL_CLIENT_ORIGIN,
  "https://htcoachingweb.netlify.app",
]);
const APPROVED_API_ORIGINS = new Set([PRODUCTION_API_ORIGIN]);

export const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const approvedOrigin = (value, fallback, approved, name) => {
  const parsed = new URL(String(value || fallback));
  assert(parsed.protocol === "https:", `${name} must use HTTPS`);
  assert(
    parsed.username === "" && parsed.password === "",
    `${name} must not contain credentials`,
  );
  assert(
    parsed.pathname === "/" && parsed.search === "" && parsed.hash === "",
    `${name} must be an origin without a path, query, or fragment`,
  );
  assert(approved.has(parsed.origin), `${name} is not an approved production origin`);
  return parsed.origin;
};

export const productionTargets = (env = process.env) => ({
  clientOrigin: approvedOrigin(
    env.PRODUCTION_CLIENT_URL,
    CANONICAL_CLIENT_ORIGIN,
    APPROVED_CLIENT_ORIGINS,
    "PRODUCTION_CLIENT_URL",
  ),
  apiOrigin: approvedOrigin(
    env.PRODUCTION_API_URL,
    PRODUCTION_API_ORIGIN,
    APPROVED_API_ORIGINS,
    "PRODUCTION_API_URL",
  ),
});

export const fetchTimed = async (url, options = {}) => {
  const startedAt = performance.now();
  const { headers = {}, ...requestOptions } = options;
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
    ...requestOptions,
    headers: {
      Accept: "*/*",
      "User-Agent": "htcoaching-production-monitor/1.0",
      ...headers,
    },
  });
  return {
    response,
    durationMs: Number((performance.now() - startedAt).toFixed(2)),
  };
};

export const parsePrometheusMetrics = (source) => {
  const metrics = new Map();
  for (const rawLine of String(source || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^([^\s]+)\s+(-?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?)$/i.exec(
      line,
    );
    if (!match) continue;
    metrics.set(match[1], Number(match[2]));
  }
  return metrics;
};

export const summarizePrometheusMetrics = (source) => {
  const metrics = parsePrometheusMetrics(source);
  const value = (name) => metrics.get(name) ?? null;
  return {
    httpRequests: value("htcoaching_http_requests"),
    httpErrors: value("htcoaching_http_errors"),
    serverErrors: value("htcoaching_server_errors"),
    cspReports: value("htcoaching_security_csp_reports"),
    rumSamples: value("htcoaching_rum_samples"),
    financialReconciliationMismatches: value(
      "htcoaching_financial_reconciliation_mismatches",
    ),
    f1MediaCleanupFailures: value("htcoaching_f1_media_cleanup_failed"),
    scheduleReminderFailures: value("htcoaching_schedule_reminder_failures"),
    httpP95Ms: value('htcoaching_http_duration_ms{quantile="0.95"}'),
    rumLcpP95Ms: value('htcoaching_rum_lcp_ms{quantile="0.95"}'),
    rumInpP95Ms: value('htcoaching_rum_inp_ms{quantile="0.95"}'),
    rumClsP95: value('htcoaching_rum_cls_score{quantile="0.95"}'),
    uptimeSeconds: value("htcoaching_process_uptime_seconds"),
  };
};

export const normalizeRumBaseline = (payload) => {
  assert(payload?.success === true, "RUM baseline returned an unsuccessful payload");
  const data = payload.data;
  assert(data && typeof data === "object", "RUM baseline payload is invalid");
  assert(data.windowDays === 7, "RUM baseline window must be seven days");
  assert(Number.isInteger(data.samples) && data.samples >= 0, "RUM sample count is invalid");
  assert(Array.isArray(data.groups) && data.groups.length <= 1000, "RUM groups are invalid");

  const numberField = (value, name) => {
    const parsed = Number(value);
    assert(Number.isFinite(parsed) && parsed >= 0, `${name} is invalid`);
    return parsed;
  };

  const groups = data.groups.map((group) => {
    const route = String(group?.route || "");
    const device = String(group?.device || "");
    const name = String(group?.name || "");
    assert(/^\/[a-zA-Z0-9/:_-]{0,119}$/.test(route), "RUM route is invalid");
    assert(["mobile", "desktop"].includes(device), "RUM device is invalid");
    assert(["LCP", "INP", "CLS"].includes(name), "RUM metric name is invalid");
    assert(Number.isInteger(group.samples) && group.samples > 0, "RUM group count is invalid");
    return {
      route,
      device,
      name,
      samples: group.samples,
      average: numberField(group.average, "RUM average"),
      p75: numberField(group.p75, "RUM p75"),
      maximum: numberField(group.maximum, "RUM maximum"),
      ratings: {
        good: numberField(group.ratings?.good || 0, "RUM good count"),
        needsImprovement: numberField(
          group.ratings?.needsImprovement || 0,
          "RUM needs-improvement count",
        ),
        poor: numberField(group.ratings?.poor || 0, "RUM poor count"),
      },
    };
  });

  return {
    windowDays: data.windowDays,
    from: String(data.from || ""),
    to: String(data.to || ""),
    samples: data.samples,
    coverageHours: numberField(data.coverageHours || 0, "RUM coverage"),
    latestAgeHours: numberField(data.latestAgeHours || 0, "RUM latest age"),
    baselineReady: data.baselineReady === true,
    firstSampleAt: data.firstSampleAt || null,
    lastSampleAt: data.lastSampleAt || null,
    groups,
  };
};

export const normalizeOperationalAlerts = (payload) => {
  assert(payload?.success === true, "Alert endpoint returned an unsuccessful payload");
  assert(Array.isArray(payload.data), "Alert endpoint returned an invalid contract");
  return payload.data.map((alert) => {
    const code = String(alert?.code || "");
    const severity = String(alert?.severity || "");
    assert(/^[a-z0-9_]{1,80}$/.test(code), "Alert code is invalid");
    assert(
      ["critical", "high", "medium", "low"].includes(severity),
      `Alert ${code} has an invalid severity`,
    );
    assert(typeof alert.active === "boolean", `Alert ${code} has an invalid state`);
    return {
      code,
      severity,
      active: alert.active,
      value: Number.isFinite(Number(alert.value)) ? Number(alert.value) : null,
    };
  });
};

export const activeOperationalAlerts = (payload) =>
  normalizeOperationalAlerts(payload).filter((alert) => alert.active);
