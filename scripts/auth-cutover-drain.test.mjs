import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveAuthCutoverProbeConfig,
  verifyAuthCutoverDrain,
} from "./auth-cutover-drain.mjs";

const SHA = "a".repeat(40);
const STAGING_PROBE_CONFIG = {
  origin: "https://htcoachingweb-staging.onrender.com",
  expectedSha: SHA,
  count: 13,
  intervalMs: 10_000,
};

const response = ({
  status = 503,
  sha = SHA,
  retryAfter = "60",
  cacheControl = "no-store",
  code = "AUTH_CUTOVER_MAINTENANCE",
} = {}) =>
  new Response(JSON.stringify({ success: false, code }), {
    status,
    headers: {
      "X-HT-Release-SHA": sha,
      "Retry-After": retryAfter,
      "Cache-Control": cacheControl,
      "Content-Type": "application/json",
    },
  });

test("verifies a sustained staging exact-SHA maintenance window", async () => {
  let calls = 0;
  const result = await verifyAuthCutoverDrain({
    config: STAGING_PROBE_CONFIG,
    fetchImpl: async () => {
      calls += 1;
      return response();
    },
    sleep: async () => {},
  });

  assert.deepEqual(result, {
    verified: true,
    origin: "https://htcoachingweb-staging.onrender.com",
    expectedSha: SHA,
    probes: 13,
    windowSeconds: 120,
  });
  assert.equal(calls, 13);
});

test("fails closed when any probe is served by another revision", async () => {
  let calls = 0;
  await assert.rejects(
    verifyAuthCutoverDrain({
      config: STAGING_PROBE_CONFIG,
      fetchImpl: async () => {
        calls += 1;
        return response({ sha: calls === 2 ? "b".repeat(40) : SHA });
      },
      sleep: async () => {},
    }),
    /attempt 2: status=503, shaMatch=false/,
  );
});

test("fails closed when a generic 503 does not come from the cutover boundary", async () => {
  await assert.rejects(
    verifyAuthCutoverDrain({
      config: STAGING_PROBE_CONFIG,
      fetchImpl: async () => response({ code: "SERVICE_UNAVAILABLE" }),
      sleep: async () => {},
    }),
    /codeMatch=false/,
  );
});

test("requires an approved origin, exact SHA and production opt-in", () => {
  const base = {
    AUTH_CUTOVER_EXPECTED_SHA: SHA,
    AUTH_CUTOVER_PROBE_COUNT: "13",
    AUTH_CUTOVER_PROBE_INTERVAL_MS: "10000",
  };

  assert.throws(
    () => resolveAuthCutoverProbeConfig({
      ...base,
      AUTH_CUTOVER_PROBE_ORIGIN: "https://example.com",
    }),
    /approved exact origin/,
  );
  assert.throws(
    () => resolveAuthCutoverProbeConfig({
      ...base,
      AUTH_CUTOVER_PROBE_ORIGIN: "https://htcoachingweb.onrender.com",
    }),
    /explicit opt-in/,
  );
  assert.equal(
    resolveAuthCutoverProbeConfig({
      ...base,
      AUTH_CUTOVER_PROBE_ORIGIN: "https://htcoachingweb.onrender.com",
      ALLOW_PRODUCTION_AUTH_CUTOVER_PROBE: "true",
    }).origin,
    "https://htcoachingweb.onrender.com",
  );
});

test("rejects a probe window shorter than the two-minute drain minimum", () => {
  assert.throws(
    () => resolveAuthCutoverProbeConfig({
      AUTH_CUTOVER_PROBE_ORIGIN: "https://htcoachingweb-staging.onrender.com",
      AUTH_CUTOVER_EXPECTED_SHA: SHA,
      AUTH_CUTOVER_PROBE_COUNT: "12",
      AUTH_CUTOVER_PROBE_INTERVAL_MS: "10000",
    }),
    /at least 120 seconds/,
  );
});
