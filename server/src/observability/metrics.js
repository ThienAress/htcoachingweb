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
  "financial.sepay_webhook_received",
  "financial.sepay_webhook_auth_failed",
  "financial.sepay_webhook_duplicates",
  "financial.sepay_auto_settled",
  "financial.sepay_needs_review",
  "financial.sepay_reconciliation_imported",
  "financial.sepay_reconciliation_failures",
  "schedule.idempotency_hits",
  "schedule.slot_conflicts",
  "schedule.revision_conflicts",
  "schedule.transaction_aborts",
  "schedule.reminders_sent",
  "schedule.reminder_failures",
  "today_dashboard.requests",
  "today_dashboard.partial_errors",
  "daily_journal.idempotency_hits",
  "daily_journal.revision_conflicts",
  "daily_journal.saves",
  "daily_journal.retention_candidates",
  "daily_journal.retention_deletions",
  "daily_journal.retention_sync_failures",
  "wellness_target.writes",
  "wellness_target.conflicts",
  "wellness_target.retention_candidates",
  "wellness_target.retention_deletions",
  "saved_meal_plan.saves",
  "saved_meal_plan.idempotency_hits",
  "saved_meal_plan.conflicts",
  "saved_meal_plan.retention_candidates",
  "saved_meal_plan.retention_deletions",
  "coaching_habit.creates",
  "coaching_habit.updates",
  "coaching_habit.status_changes",
  "coaching_habit.idempotency_hits",
  "coaching_habit.conflicts",
  "coaching_habit.retention_candidates",
  "coaching_habit.retention_deletions",
  "weekly_checkin.saves",
  "weekly_checkin.reviews",
  "weekly_checkin.idempotency_hits",
  "weekly_checkin.revision_conflicts",
  "weekly_checkin.retention_candidates",
  "weekly_checkin.retention_deletions",
  "progress.requests",
  "progress.errors",
  "coaching_comment.creates",
  "coaching_comment.edits",
  "coaching_comment.removals",
  "coaching_comment.idempotency_hits",
  "coaching_comment.conflicts",
  "coaching_comment.retention_candidates",
  "coaching_comment.retention_deletions",
  "notification.created",
  "notification.deduped",
  "notification.suppressed",
  "notification.read",
  "notification.retention_candidates",
  "notification.retention_deletions",
  "trainer_overview.requests",
  "trainer_overview.errors",
  "coaching_activity.requests",
  "coaching_activity.exports",
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
  "today_dashboard.aggregation_latency_ms",
  "progress.aggregation_latency_ms",
  "f1.media_processing_ms",
  "rum.lcp_ms",
  "rum.inp_ms",
  "rum.cls_score",
]);

const counters = new Map([...COUNTER_NAMES].map((name) => [name, 0]));
const summaries = new Map();
const httpRoutes = new Map();
const rollingCounterEvents = new Map();
const rollingSummaryEvents = new Map();
const rollingHttpEvents = [];
const MAX_SAMPLES = 500;
const MAX_HTTP_ROUTES = 200;
const MAX_ROLLING_EVENTS = 5_000;
const ROLLING_WINDOW_MS = 5 * 60 * 1_000;

const percentile = (values, ratio) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(Math.ceil(sorted.length * ratio) - 1, sorted.length - 1)];
};

const appendBounded = (items, value) => {
  items.push(value);
  if (items.length > MAX_ROLLING_EVENTS) items.shift();
};

const eventTimestamp = (value) => {
  const parsed = Number(value ?? Date.now());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : Date.now();
};

const rollingValues = (events, nowMs) => {
  const fromMs = nowMs - ROLLING_WINDOW_MS;
  return events.filter(({ recordedAt }) => recordedAt > fromMs && recordedAt <= nowMs);
};

export const incrementMetric = (name, amount = 1, options = {}) => {
  if (!COUNTER_NAMES.has(name)) throw new Error(`Unknown counter metric: ${name}`);
  counters.set(name, (counters.get(name) || 0) + amount);
  const events = rollingCounterEvents.get(name) || [];
  appendBounded(events, {
    amount,
    recordedAt: eventTimestamp(options.recordedAt),
  });
  rollingCounterEvents.set(name, events);
};

export const observeMetric = (name, value, options = {}) => {
  if (!SUMMARY_NAMES.has(name)) throw new Error(`Unknown summary metric: ${name}`);
  if (!Number.isFinite(value) || value < 0) return;
  const samples = summaries.get(name) || [];
  samples.push(value);
  if (samples.length > MAX_SAMPLES) samples.shift();
  summaries.set(name, samples);
  const events = rollingSummaryEvents.get(name) || [];
  appendBounded(events, {
    value,
    recordedAt: eventTimestamp(options.recordedAt),
  });
  rollingSummaryEvents.set(name, events);
};

export const recordHttpRequest = ({
  method,
  route,
  status,
  durationMs,
  recordedAt,
}) => {
  const timestamp = eventTimestamp(recordedAt);
  incrementMetric("http.requests", 1, { recordedAt: timestamp });
  if (status >= 500) incrementMetric("http.errors", 1, { recordedAt: timestamp });
  observeMetric("http.duration_ms", durationMs, { recordedAt: timestamp });
  appendBounded(rollingHttpEvents, {
    status,
    durationMs,
    recordedAt: timestamp,
  });

  const normalizedRoute = String(route || "unmatched").slice(0, 160);
  const key = `${method} ${normalizedRoute} ${Math.floor(status / 100)}xx`;
  if (!httpRoutes.has(key) && httpRoutes.size >= MAX_HTTP_ROUTES) return;
  const current = httpRoutes.get(key) || { count: 0, totalMs: 0, maxMs: 0 };
  current.count += 1;
  current.totalMs += durationMs;
  current.maxMs = Math.max(current.maxMs, durationMs);
  httpRoutes.set(key, current);
};

const rollingCounterValue = (name, nowMs) =>
  rollingValues(rollingCounterEvents.get(name) || [], nowMs).reduce(
    (total, event) => total + event.amount,
    0,
  );

const rollingSummary = (name, nowMs) => {
  const values = rollingValues(rollingSummaryEvents.get(name) || [], nowMs).map(
    ({ value }) => value,
  );
  return {
    samples: values.length,
    p95: percentile(values, 0.95),
  };
};

const getRollingSnapshot = (nowMs) => {
  const http = rollingValues(rollingHttpEvents, nowMs);
  const httpErrors5xx = http.filter(({ status }) => status >= 500).length;
  const memory = process.memoryUsage();
  const db = rollingSummary("db.query_latency_ms", nowMs);
  const provider = rollingSummary("ai.total_latency_ms", nowMs);
  return {
    windowSeconds: ROLLING_WINDOW_MS / 1_000,
    from: new Date(nowMs - ROLLING_WINDOW_MS).toISOString(),
    to: new Date(nowMs).toISOString(),
    httpRequests: http.length,
    httpErrors5xx,
    httpErrorRate: http.length
      ? Number((httpErrors5xx / http.length).toFixed(4))
      : 0,
    httpP95Ms: percentile(
      http.map(({ durationMs }) => durationMs),
      0.95,
    ),
    dbSamples: db.samples,
    dbP95Ms: db.p95,
    providerSamples: provider.samples,
    providerP95Ms: provider.p95,
    providerFailures:
      rollingCounterValue("ai.errors", nowMs) +
      rollingCounterValue("kb.embedding_failures", nowMs),
    heapUsedBytes: memory.heapUsed,
    heapTotalBytes: memory.heapTotal,
    heapUtilization: memory.heapTotal
      ? Number((memory.heapUsed / memory.heapTotal).toFixed(4))
      : 0,
  };
};

export const getMetricsSnapshot = ({ nowMs = Date.now() } = {}) => ({
  generatedAt: new Date(nowMs).toISOString(),
  uptimeSeconds: Math.round(process.uptime()),
  memory: {
    rssBytes: process.memoryUsage().rss,
    heapUsedBytes: process.memoryUsage().heapUsed,
    heapTotalBytes: process.memoryUsage().heapTotal,
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
  rolling: getRollingSnapshot(nowMs),
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
  lines.push(`htcoaching_process_heap_total_bytes ${snapshot.memory.heapTotalBytes}`);
  lines.push(`htcoaching_window_seconds ${snapshot.rolling.windowSeconds}`);
  lines.push(`htcoaching_window_http_requests ${snapshot.rolling.httpRequests}`);
  lines.push(`htcoaching_window_http_5xx ${snapshot.rolling.httpErrors5xx}`);
  lines.push(`htcoaching_window_http_5xx_rate ${snapshot.rolling.httpErrorRate}`);
  lines.push(`htcoaching_window_http_p95_ms ${snapshot.rolling.httpP95Ms}`);
  lines.push(`htcoaching_window_db_p95_ms ${snapshot.rolling.dbP95Ms}`);
  lines.push(`htcoaching_window_provider_p95_ms ${snapshot.rolling.providerP95Ms}`);
  lines.push(`htcoaching_window_provider_failures ${snapshot.rolling.providerFailures}`);
  lines.push(`htcoaching_process_heap_utilization ${snapshot.rolling.heapUtilization}`);
  return `${lines.join("\n")}\n`;
};

export const getOperationalAlerts = ({ nowMs = Date.now() } = {}) => {
  const countersSnapshot = Object.fromEntries(counters);
  const rolling = getRollingSnapshot(nowMs);
  return [
    {
      code: "financial_reconciliation_mismatch",
      severity: "critical",
      active:
        countersSnapshot["financial.reconciliation_mismatches"] > 0,
      value: countersSnapshot["financial.reconciliation_mismatches"],
      runbook: "docs/operations/runbooks/incident-runbook.md#financial-reconciliation",
    },
    {
      code: "f1_media_cleanup_failure",
      severity: "high",
      active: countersSnapshot["f1.media_cleanup_failed"] > 0,
      value: countersSnapshot["f1.media_cleanup_failed"],
      runbook: "docs/phases/phase-09/phase-9-operations-runbook.md#f1-media-cleanup",
    },
    {
      code: "schedule_reminder_failure",
      severity: "high",
      active: countersSnapshot["schedule.reminder_failures"] > 0,
      value: countersSnapshot["schedule.reminder_failures"],
      runbook: "docs/operations/runbooks/incident-runbook.md#reminders",
    },
    {
      code: "daily_journal_retention_sync_failure",
      severity: "high",
      active:
        countersSnapshot["daily_journal.retention_sync_failures"] > 0,
      value: countersSnapshot["daily_journal.retention_sync_failures"],
      runbook:
        "docs/operations/runbooks/today-dashboard-release-b.md#retention-sync-failure",
    },
    {
      code: "http_5xx",
      severity: "high",
      active:
        rolling.httpRequests >= 20 &&
        rolling.httpErrors5xx >= 2 &&
        rolling.httpErrorRate >= 0.05,
      value: rolling.httpErrorRate,
      runbook: "docs/operations/runbooks/incident-runbook.md#http-errors",
    },
    {
      code: "http_latency",
      severity: "high",
      active: rolling.httpRequests >= 20 && rolling.httpP95Ms >= 2_000,
      value: rolling.httpP95Ms,
      runbook: "docs/operations/runbooks/incident-runbook.md#http-errors",
    },
    {
      code: "database_latency",
      severity: "high",
      active: rolling.dbSamples >= 20 && rolling.dbP95Ms >= 1_000,
      value: rolling.dbP95Ms,
      runbook: "docs/operations/runbooks/incident-runbook.md#database",
    },
    {
      code: "provider_failures",
      severity: "high",
      active: rolling.providerFailures >= 3,
      value: rolling.providerFailures,
      runbook: "docs/operations/runbooks/incident-runbook.md#external-providers",
    },
    {
      code: "heap_pressure",
      severity: "high",
      active: rolling.heapUtilization >= 0.9,
      value: rolling.heapUtilization,
      runbook: "docs/operations/runbooks/incident-runbook.md#memory",
    },
  ];
};

export const resetMetricsForTests = () => {
  for (const name of COUNTER_NAMES) counters.set(name, 0);
  summaries.clear();
  httpRoutes.clear();
  rollingCounterEvents.clear();
  rollingSummaryEvents.clear();
  rollingHttpEvents.length = 0;
};
