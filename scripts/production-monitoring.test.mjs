import test from "node:test";
import assert from "node:assert/strict";

import {
  activeOperationalAlerts,
  parsePrometheusMetrics,
  productionTargets,
  normalizeRumBaseline,
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
htcoaching_security_csp_reports 1
htcoaching_rum_samples 20
htcoaching_rum_lcp_ms{quantile="0.95"} 2400
htcoaching_rum_inp_ms{quantile="0.95"} 180
htcoaching_rum_cls_score{quantile="0.95"} 0.08
htcoaching_process_uptime_seconds 3600
`;
  const metrics = parsePrometheusMetrics(source);
  assert.equal(metrics.get("htcoaching_http_requests"), 120);
  assert.deepEqual(summarizePrometheusMetrics(source), {
    httpRequests: 120,
    httpErrors: 2,
    serverErrors: null,
    cspReports: 1,
    rumSamples: 20,
    financialReconciliationMismatches: null,
    f1MediaCleanupFailures: null,
    scheduleReminderFailures: null,
    httpP95Ms: 245.5,
    rumLcpP95Ms: 2400,
    rumInpP95Ms: 180,
    rumClsP95: 0.08,
    uptimeSeconds: 3600,
  });
});

test("RUM baseline normalization keeps only bounded aggregate fields", () => {
  assert.deepEqual(
    normalizeRumBaseline({
      success: true,
      data: {
        windowDays: 7,
        from: "2026-07-16T00:00:00.000Z",
        to: "2026-07-23T00:00:00.000Z",
        samples: 2,
        coverageHours: 168,
        latestAgeHours: 1,
        baselineReady: true,
        firstSampleAt: "2026-07-16T00:00:00.000Z",
        lastSampleAt: "2026-07-23T00:00:00.000Z",
        groups: [
          {
            route: "/cong-thuc-nau-an",
            device: "mobile",
            name: "LCP",
            samples: 2,
            average: 2100,
            p75: 2400,
            maximum: 2500,
            ratings: { good: 2, needsImprovement: 0, poor: 0 },
            privateField: "discarded",
          },
        ],
      },
    }),
    {
      windowDays: 7,
      from: "2026-07-16T00:00:00.000Z",
      to: "2026-07-23T00:00:00.000Z",
      samples: 2,
      coverageHours: 168,
      latestAgeHours: 1,
      baselineReady: true,
      firstSampleAt: "2026-07-16T00:00:00.000Z",
      lastSampleAt: "2026-07-23T00:00:00.000Z",
      groups: [
        {
          route: "/cong-thuc-nau-an",
          device: "mobile",
          name: "LCP",
          samples: 2,
          average: 2100,
          p75: 2400,
          maximum: 2500,
          ratings: { good: 2, needsImprovement: 0, poor: 0 },
        },
      ],
    },
  );
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
