import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  activeOperationalAlerts,
  parsePrometheusMetrics,
  productionTargets,
  retryReadOnlyOperation,
  sitemapIndexUrls,
  sitemapIncludesCanonicalPath,
  validateGoogleOAuthRedirect,
  normalizeRumBaseline,
  summarizePrometheusMetrics,
} from "./lib/production-monitoring.mjs";

test("split sitemap index resolves bounded same-origin child sitemaps", () => {
  const sitemap = `
<sitemapindex>
  <sitemap><loc>https://htcoachingweb.io.vn/sitemap-core.xml</loc></sitemap>
  <sitemap><loc>https://htcoachingweb.io.vn/sitemap-content.xml</loc></sitemap>
</sitemapindex>`;

  assert.deepEqual(sitemapIndexUrls(sitemap), [
    "https://htcoachingweb.io.vn/sitemap-core.xml",
    "https://htcoachingweb.io.vn/sitemap-content.xml",
  ]);
});

test("split sitemap index rejects an external child sitemap", () => {
  assert.throws(
    () =>
      sitemapIndexUrls(
        "<sitemapindex><loc>https://example.com/sitemap.xml</loc></sitemapindex>",
      ),
    /approved production origin/,
  );
});

test("sitemap matching accepts canonical routes with or without a trailing slash", () => {
  const sitemap = [
    "<urlset>",
    "<loc>https://htcoachingweb.io.vn/blog/</loc>",
    "<loc>https://htcoachingweb.io.vn/cong-thuc-nau-an</loc>",
    "<loc>https://htcoachingweb.io.vn/blog/current-post/</loc>",
    "</urlset>",
  ].join("");

  assert.equal(sitemapIncludesCanonicalPath(sitemap, "/blog"), true);
  assert.equal(
    sitemapIncludesCanonicalPath(sitemap, "/cong-thuc-nau-an/"),
    true,
  );
  assert.equal(
    sitemapIncludesCanonicalPath(sitemap, "/blog/current-post"),
    true,
  );
  assert.equal(sitemapIncludesCanonicalPath(sitemap, "/missing"), false);
});

test("production targets accept only explicit application origins", () => {
  assert.deepEqual(productionTargets({}), {
    clientOrigin: "https://htcoachingweb.io.vn",
    apiOrigin: "https://api.htcoachingweb.io.vn",
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

test("Google OAuth redirect stays on the canonical production API", () => {
  const location = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  location.searchParams.set(
    "redirect_uri",
    "https://api.htcoachingweb.io.vn/api/auth/google/callback",
  );
  location.searchParams.set("state", "signed-state");

  assert.deepEqual(validateGoogleOAuthRedirect(location), {
    providerOrigin: "https://accounts.google.com",
    callbackUri:
      "https://api.htcoachingweb.io.vn/api/auth/google/callback",
  });
  location.searchParams.set(
    "redirect_uri",
    "https://htcoachingweb.onrender.com/api/auth/google/callback",
  );
  assert.throws(
    () => validateGoogleOAuthRedirect(location),
    /canonical production API/,
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

test("read-only retry recovers from bounded transient failures", async () => {
  let calls = 0;
  const retries = [];
  const result = await retryReadOnlyOperation(
    async () => {
      calls += 1;
      if (calls < 3) throw new Error(`transient-${calls}`);
      return "healthy";
    },
    {
      attempts: 3,
      delayMs: 0,
      onRetry: (error, attempt) => retries.push([error.message, attempt]),
    },
  );

  assert.equal(result, "healthy");
  assert.equal(calls, 3);
  assert.deepEqual(retries, [
    ["transient-1", 1],
    ["transient-2", 2],
  ]);
});

test("read-only retry preserves the final persistent failure", async () => {
  let calls = 0;
  await assert.rejects(
    retryReadOnlyOperation(
      async () => {
        calls += 1;
        throw new Error(`persistent-${calls}`);
      },
      { attempts: 2, delayMs: 0 },
    ),
    /persistent-2/,
  );
  assert.equal(calls, 2);
});

test("production alert workflow links the canonical runbook and requires manual closure", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/production-monitor.yml", import.meta.url),
    "utf8",
  );

  assert.match(
    workflow,
    /docs\/operations\/runbooks\/production-rollback-runbook\.md/,
  );
  assert.doesNotMatch(workflow, /issues\.update\([\s\S]*state:\s*"closed"/);
  assert.match(workflow, /owner review/i);
});

test("staging Netlify builds fail closed on canonical dynamic route content", async () => {
  const config = await readFile(
    new URL("../netlify.toml", import.meta.url),
    "utf8",
  );
  const stagingEnvironment = config.match(
    /\[context\.staging\.environment\]([\s\S]*?)(?=\n\[|$)/,
  )?.[1];

  assert.ok(stagingEnvironment, "missing staging environment block");
  assert.match(stagingEnvironment, /REQUIRE_DYNAMIC_ROUTES\s*=\s*"true"/);
  assert.match(
    stagingEnvironment,
    /SITEMAP_API_URL\s*=\s*"https:\/\/api\.htcoachingweb\.io\.vn\/api"/,
  );
  assert.match(
    stagingEnvironment,
    /PRERENDER_API_URL\s*=\s*"https:\/\/api\.htcoachingweb\.io\.vn\/api"/,
  );
  assert.match(stagingEnvironment, /PRERENDER_CONCURRENCY\s*=\s*"6"/);
  assert.doesNotMatch(stagingEnvironment, /VITE_API_URL\s*=/);
});
