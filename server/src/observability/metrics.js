const COUNTER_NAMES = new Set([
  "http.requests",
  "http.errors",
  "server.errors",
  "ai.requests",
  "ai.completed",
  "ai.errors",
  "ai.aborts",
  "ai.tool_calls",
  "ai.tool_failures",
  "ai.moderation_blocks",
  "kb.embedding_failures",
  "kb.search_no_hits",
  "kb.vector_fallbacks",
  "checkin.idempotency_hits",
  "checkin.transaction_aborts",
  "coaching.revision_conflicts",
  "coaching.cleanup_failures",
  "content.cleanup_failures",
  "financial.reversals",
  "financial.conflicts",
  "financial.idempotency_hits",
  "financial.reconciliation_mismatches",
  "schedule.idempotency_hits",
  "schedule.slot_conflicts",
  "schedule.revision_conflicts",
  "schedule.transaction_aborts",
  "schedule.reminders_sent",
  "schedule.reminder_failures",
  "booking.idempotency_hits",
  "booking.transition_conflicts",
  "f1.media_uploaded",
  "f1.media_upload_failed",
  "f1.media_deleted",
  "f1.media_cleanup_failed",
  "f1.media_orphans",
  "f1.media_quota_rejected",
  "f1.code_conflicts",
  "f1.artifact_idempotency_hits",
  "f1.artifact_conflicts",
  "f1.retention_candidates",
  "f1.deletion_completed",
  "security.csp_reports",
  "rum.samples",
]);

const SUMMARY_NAMES = new Set([
  "http.duration_ms",
  "ai.total_latency_ms",
  "ai.tool_latency_ms",
  "kb.search_latency_ms",
  "db.query_latency_ms",
  "f1.media_processing_ms",
  "rum.lcp_ms",
  "rum.inp_ms",
  "rum.cls_score",
]);

const counters = new Map([...COUNTER_NAMES].map((name) => [name, 0]));
const summaries = new Map();
const httpRoutes = new Map();
const MAX_SAMPLES = 500;
const MAX_HTTP_ROUTES = 200;

const percentile = (values, ratio) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(Math.ceil(sorted.length * ratio) - 1, sorted.length - 1)];
};

export const incrementMetric = (name, amount = 1) => {
  if (!COUNTER_NAMES.has(name)) throw new Error(`Unknown counter metric: ${name}`);
  counters.set(name, (counters.get(name) || 0) + amount);
};

export const observeMetric = (name, value) => {
  if (!SUMMARY_NAMES.has(name)) throw new Error(`Unknown summary metric: ${name}`);
  if (!Number.isFinite(value) || value < 0) return;
  const samples = summaries.get(name) || [];
  samples.push(value);
  if (samples.length > MAX_SAMPLES) samples.shift();
  summaries.set(name, samples);
};

export const recordHttpRequest = ({ method, route, status, durationMs }) => {
  incrementMetric("http.requests");
  if (status >= 500) incrementMetric("http.errors");
  observeMetric("http.duration_ms", durationMs);

  const normalizedRoute = String(route || "unmatched").slice(0, 160);
  const key = `${method} ${normalizedRoute} ${Math.floor(status / 100)}xx`;
  if (!httpRoutes.has(key) && httpRoutes.size >= MAX_HTTP_ROUTES) return;
  const current = httpRoutes.get(key) || { count: 0, totalMs: 0, maxMs: 0 };
  current.count += 1;
  current.totalMs += durationMs;
  current.maxMs = Math.max(current.maxMs, durationMs);
  httpRoutes.set(key, current);
};

export const getMetricsSnapshot = () => ({
  generatedAt: new Date().toISOString(),
  uptimeSeconds: Math.round(process.uptime()),
  memory: {
    rssBytes: process.memoryUsage().rss,
    heapUsedBytes: process.memoryUsage().heapUsed,
  },
  counters: Object.fromEntries(counters),
  summaries: Object.fromEntries(
    [...SUMMARY_NAMES].map((name) => {
      const values = summaries.get(name) || [];
      const total = values.reduce((sum, value) => sum + value, 0);
      return [
        name,
        {
          samples: values.length,
          average: values.length ? Number((total / values.length).toFixed(2)) : 0,
          p50: percentile(values, 0.5),
          p95: percentile(values, 0.95),
          max: values.length ? Math.max(...values) : 0,
        },
      ];
    }),
  ),
  httpRoutes: Object.fromEntries(
    [...httpRoutes].map(([key, value]) => [
      key,
      {
        count: value.count,
        averageMs: Number((value.totalMs / value.count).toFixed(2)),
        maxMs: value.maxMs,
      },
    ]),
  ),
});

const prometheusName = (value) =>
  `htcoaching_${String(value).replace(/[^a-zA-Z0-9_]/g, "_")}`;

export const getPrometheusMetrics = () => {
  const snapshot = getMetricsSnapshot();
  const lines = [];
  for (const [name, value] of Object.entries(snapshot.counters)) {
    const metric = prometheusName(name);
    lines.push(`# TYPE ${metric} counter`, `${metric} ${value}`);
  }
  for (const [name, summary] of Object.entries(snapshot.summaries)) {
    const metric = prometheusName(name);
    lines.push(`# TYPE ${metric} summary`);
    lines.push(`${metric}{quantile="0.5"} ${summary.p50}`);
    lines.push(`${metric}{quantile="0.95"} ${summary.p95}`);
    lines.push(`${metric}_count ${summary.samples}`);
    lines.push(
      `${metric}_sum ${Number(
        summary.average * summary.samples,
      ).toFixed(2)}`,
    );
  }
  lines.push(`htcoaching_process_uptime_seconds ${snapshot.uptimeSeconds}`);
  lines.push(`htcoaching_process_rss_bytes ${snapshot.memory.rssBytes}`);
  lines.push(
    `htcoaching_process_heap_used_bytes ${snapshot.memory.heapUsedBytes}`,
  );
  return `${lines.join("\n")}\n`;
};

export const getOperationalAlerts = () => {
  const countersSnapshot = Object.fromEntries(counters);
  return [
    {
      code: "financial_reconciliation_mismatch",
      severity: "critical",
      active:
        countersSnapshot["financial.reconciliation_mismatches"] > 0,
      value: countersSnapshot["financial.reconciliation_mismatches"],
      runbook: "docs/incident-runbook.md#financial-reconciliation",
    },
    {
      code: "f1_media_cleanup_failure",
      severity: "high",
      active: countersSnapshot["f1.media_cleanup_failed"] > 0,
      value: countersSnapshot["f1.media_cleanup_failed"],
      runbook: "docs/phase-9-operations-runbook.md#f1-media-cleanup",
    },
    {
      code: "schedule_reminder_failure",
      severity: "high",
      active: countersSnapshot["schedule.reminder_failures"] > 0,
      value: countersSnapshot["schedule.reminder_failures"],
      runbook: "docs/incident-runbook.md#reminders",
    },
    {
      code: "http_5xx",
      severity: "high",
      active: countersSnapshot["http.errors"] > 0,
      value: countersSnapshot["http.errors"],
      runbook: "docs/incident-runbook.md#http-errors",
    },
  ];
};

export const resetMetricsForTests = () => {
  for (const name of COUNTER_NAMES) counters.set(name, 0);
  summaries.clear();
  httpRoutes.clear();
};
