import test from "node:test";
import assert from "node:assert/strict";

import {
  activeOperationalAlerts,
  parsePrometheusMetrics,
  productionTargets,
  summarizePrometheusMetrics,
} from "./lib/production-monitoring.mjs";

test("production targets accept only explicit application origins", () => {
  assert.deepEqual(productionTargets({}), {
    clientOrigin: "https://htcoachingweb.io.vn",
    apiOrigin: "https://htcoachingweb.onrender.com",
  });
  assert.throws(
    () =>
      productionTargets({
        PRODUCTION_API_URL: "https://example.com",
      }),
    /not an approved production origin/,
  );
  assert.throws(
    () =>
      productionTargets({
        PRODUCTION_CLIENT_URL: "https://htcoachingweb.io.vn/private",
      }),
    /must be an origin/,
  );
});

test("Prometheus parser returns a bounded release summary", () => {
  const source = `
# TYPE htcoaching_http_requests counter
htcoaching_http_requests 120
htcoaching_http_errors 2
htcoaching_http_duration_ms{quantile="0.95"} 245.5
htcoaching_process_uptime_seconds 3600
`;
  const metrics = parsePrometheusMetrics(source);
  assert.equal(metrics.get("htcoaching_http_requests"), 120);
  assert.deepEqual(summarizePrometheusMetrics(source), {
    httpRequests: 120,
    httpErrors: 2,
    serverErrors: null,
    financialReconciliationMismatches: null,
    f1MediaCleanupFailures: null,
    scheduleReminderFailures: null,
    httpP95Ms: 245.5,
    uptimeSeconds: 3600,
  });
});

test("operational alert evaluation exposes only safe bounded fields", () => {
  const active = activeOperationalAlerts({
    success: true,
    data: [
      {
        code: "http_5xx",
        severity: "high",
        active: true,
        value: 2,
        runbook: "private detail is not copied",
      },
      {
        code: "schedule_reminder_failure",
        severity: "high",
        active: false,
        value: 0,
      },
    ],
  });
  assert.deepEqual(active, [
    { code: "http_5xx", severity: "high", active: true, value: 2 },
  ]);
});
