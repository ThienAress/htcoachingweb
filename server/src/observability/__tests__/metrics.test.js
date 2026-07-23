import { beforeEach, describe, expect, it } from "vitest";

import {
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
});
