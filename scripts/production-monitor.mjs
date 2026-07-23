import {
  activeOperationalAlerts,
  assert,
  fetchTimed,
  productionTargets,
  normalizeRumBaseline,
  summarizePrometheusMetrics,
} from "./lib/production-monitoring.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const main = async () => {
  assert(
    process.env.ALLOW_REMOTE_PRODUCTION_MONITOR === "true",
    "Set ALLOW_REMOTE_PRODUCTION_MONITOR=true after confirming production targets",
  );
  const token = String(process.env.OPS_METRICS_TOKEN || "");
  assert(
    token.length >= 24,
    "OPS_METRICS_TOKEN is required and must be at least 24 characters",
  );
  const targets = productionTargets();
  const headers = { "X-Ops-Token": token };

  const metricsResult = await fetchTimed(
    targets.apiOrigin + "/api/ops/metrics/prometheus",
    { headers },
  );
  assert(
    metricsResult.response.status === 200,
    "Prometheus metrics returned " + metricsResult.response.status,
  );
  assert(
    metricsResult.response.headers.get("content-type")?.includes("text/plain"),
    "Prometheus metrics did not return text",
  );
  const metrics = summarizePrometheusMetrics(
    await metricsResult.response.text(),
  );
  assert(metrics.httpRequests !== null, "HTTP request metric is missing");
  assert(metrics.httpErrors !== null, "HTTP error metric is missing");

  const alertsResult = await fetchTimed(
    targets.apiOrigin + "/api/ops/alerts",
    { headers: { ...headers, Accept: "application/json" } },
  );
  assert(
    alertsResult.response.status === 200,
    "Operational alerts returned " + alertsResult.response.status,
  );
  const alertsPayload = await alertsResult.response.json();
  const activeAlerts = activeOperationalAlerts(alertsPayload);
  const rumResult = await fetchTimed(
    targets.apiOrigin + "/api/ops/rum-baseline",
    { headers: { ...headers, Accept: "application/json" } },
  );
  assert(
    rumResult.response.status === 200,
    "RUM baseline returned " + rumResult.response.status,
  );
  const rumBaseline = normalizeRumBaseline(await rumResult.response.json());

  const result = {
    success: activeAlerts.length === 0,
    checkedAt: new Date().toISOString(),
    metrics,
    rumBaseline,
    activeAlerts,
    durationsMs: {
      prometheus: metricsResult.durationMs,
      alerts: alertsResult.durationMs,
      rumBaseline: rumResult.durationMs,
    },
  };
  const output = JSON.stringify(result, null, 2) + "\n";
  const outputPath = String(process.env.PRODUCTION_MONITOR_OUTPUT || "").trim();
  if (outputPath) {
    const resolved = path.resolve(outputPath);
    await mkdir(path.dirname(resolved), { recursive: true });
    await writeFile(resolved, output, { encoding: "utf8", mode: 0o600 });
  }
  if (activeAlerts.length > 0) {
    process.stderr.write(output);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(output);
};

main().catch((error) => {
  process.stderr.write(
    JSON.stringify({ success: false, error: error.message }) + "\n",
  );
  process.exitCode = 1;
});
