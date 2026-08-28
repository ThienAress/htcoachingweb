import { beforeEach, describe, expect, it } from "vitest";

import {
  getOperationalAlerts,
  getPrometheusMetrics,
  getMetricsSnapshot,
  incrementMetric,
  observeMetric,
  recordHttpRequest,
  resetMetricsForTests,
} from "../metrics.js";
import { searchKnowledgeBase } from "../../services/ai/embedding.service.js";

describe("bounded application metrics", () => {
  beforeEach(() => {
    resetMetricsForTests();
  });

  it("records counters, latency percentiles, and normalized HTTP groups", () => {
    incrementMetric("ai.requests");
    incrementMetric("ai.requests", 2);
    observeMetric("ai.total_latency_ms", 10);
    observeMetric("ai.total_latency_ms", 30);
    recordHttpRequest({
      method: "GET",
      route: "/api/blog",
      status: 200,
      durationMs: 20,
    });

    const snapshot = getMetricsSnapshot();
    expect(snapshot.counters["ai.requests"]).toBe(3);
    expect(snapshot.counters["http.requests"]).toBe(1);
    expect(snapshot.summaries["ai.total_latency_ms"]).toMatchObject({
      samples: 2,
      average: 20,
      p50: 10,
      p95: 30,
      max: 30,
    });
    expect(snapshot.httpRoutes["GET /api/blog 2xx"]).toEqual({
      count: 1,
      averageMs: 20,
      maxMs: 20,
    });
  });

  it("rejects unknown metric names and ignores invalid samples", () => {
    expect(() => incrementMetric("user.email")).toThrow("Unknown counter");
    observeMetric("db.query_latency_ms", -1);
    observeMetric("db.query_latency_ms", Number.NaN);
    expect(
      getMetricsSnapshot().summaries["db.query_latency_ms"].samples,
    ).toBe(0);
  });

  it("bounds route cardinality", () => {
    for (let index = 0; index < 250; index += 1) {
      recordHttpRequest({
        method: "GET",
        route: `/api/items/${index}`,
        status: 200,
        durationMs: 1,
      });
    }
    expect(Object.keys(getMetricsSnapshot().httpRoutes)).toHaveLength(200);
  });

  it("records bounded Knowledge Base no-hit latency", async () => {
    await expect(searchKnowledgeBase("")).resolves.toEqual([]);
    const snapshot = getMetricsSnapshot();
    expect(snapshot.counters["kb.search_no_hits"]).toBe(1);
    expect(snapshot.summaries["kb.search_latency_ms"].samples).toBe(1);
  });

  it("expires HTTP errors outside the rolling five-minute window", () => {
    recordHttpRequest({
      method: "GET",
      route: "/api/old-error",
      status: 503,
      durationMs: 2500,
      recordedAt: 1_000,
    });
    for (let index = 0; index < 20; index += 1) {
      recordHttpRequest({
        method: "GET",
        route: "/api/current",
        status: 200,
        durationMs: 100 + index,
        recordedAt: 301_001,
      });
    }

    const snapshot = getMetricsSnapshot({ nowMs: 301_001 });
    expect(snapshot.rolling).toMatchObject({
      windowSeconds: 300,
      httpRequests: 20,
      httpErrors5xx: 0,
      httpErrorRate: 0,
      httpP95Ms: 118,
    });
    expect(
      getOperationalAlerts({ nowMs: 301_001 }).find(
        ({ code }) => code === "http_5xx",
      )?.active,
    ).toBe(false);
  });

  it("alerts on a sustained rolling 5xx rate and exposes bounded latency signals", () => {
    for (let index = 0; index < 20; index += 1) {
      recordHttpRequest({
        method: "GET",
        route: "/api/current",
        status: index < 2 ? 500 : 200,
        durationMs: 100 + index,
        recordedAt: 60_000 + index,
      });
      observeMetric("db.query_latency_ms", 200 + index, {
        recordedAt: 60_000 + index,
      });
      observeMetric("ai.total_latency_ms", 300 + index, {
        recordedAt: 60_000 + index,
      });
    }

    const snapshot = getMetricsSnapshot({ nowMs: 61_000 });
    expect(snapshot.rolling).toMatchObject({
      httpRequests: 20,
      httpErrors5xx: 2,
      httpErrorRate: 0.1,
      dbP95Ms: 218,
      providerP95Ms: 318,
    });
    expect(
      getOperationalAlerts({ nowMs: 61_000 }).find(
        ({ code }) => code === "http_5xx",
      ),
    ).toMatchObject({ active: true, value: 0.1 });
  });

  it("measures heap pressure against the V8 heap size limit", () => {
    const mebibyte = 1024 ** 2;
    const falsePositiveOptions = {
      nowMs: 61_000,
      memoryUsage: {
        rss: 250 * mebibyte,
        heapUsed: 95 * mebibyte,
        heapTotal: 100 * mebibyte,
      },
      heapStatistics: { heap_size_limit: 512 * mebibyte },
    };

    const snapshot = getMetricsSnapshot(falsePositiveOptions);
    expect(snapshot.memory).toMatchObject({
      heapUsedBytes: 95 * mebibyte,
      heapTotalBytes: 100 * mebibyte,
      heapSizeLimitBytes: 512 * mebibyte,
    });
    expect(snapshot.rolling.heapUtilization).toBe(0.1855);
    expect(
      getOperationalAlerts(falsePositiveOptions).find(
        ({ code }) => code === "heap_pressure",
      ),
    ).toMatchObject({ active: false, value: 0.1855 });
    const prometheus = getPrometheusMetrics(falsePositiveOptions);
    expect(prometheus).toContain(
      `htcoaching_process_heap_size_limit_bytes ${512 * mebibyte}`,
    );
    expect(prometheus).toContain("htcoaching_process_heap_utilization 0.1855");

    const truePressureOptions = {
      ...falsePositiveOptions,
      memoryUsage: {
        ...falsePositiveOptions.memoryUsage,
        heapUsed: 470 * mebibyte,
        heapTotal: 480 * mebibyte,
      },
    };
    expect(
      getOperationalAlerts(truePressureOptions).find(
        ({ code }) => code === "heap_pressure",
      ),
    ).toMatchObject({ active: true, value: 0.918 });
  });

  it("exports rolling, latency and heap signals to Prometheus", () => {
    recordHttpRequest({
      method: "GET",
      route: "/api/ops/health/ready",
      status: 200,
      durationMs: 25,
    });
    const source = getPrometheusMetrics();
    const metrics = [
      "htcoaching_window_http_5xx_rate",
      "htcoaching_window_http_p95_ms",
      "htcoaching_window_db_p95_ms",
      "htcoaching_window_provider_p95_ms",
      "htcoaching_process_heap_total_bytes",
      "htcoaching_process_heap_size_limit_bytes",
      "htcoaching_process_heap_utilization",
    ];
    expect(metrics.every((metric) => source.includes(metric))).toBe(true);
  });
});
