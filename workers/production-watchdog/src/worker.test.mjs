import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import worker, {
  buildFailureMessage,
  buildRecoveryMessage,
  evaluateHealthTransition,
  handleTelegramWebhook,
  IncidentCoordinator,
  probeProduction,
  runScheduledCheck,
  sanitizeIncidentText,
} from "./worker.mjs";

const incidentId = "INC-20260904-1046";

test("deployment config keeps the cost-aware bounded cold-start policy", async () => {
  const wrangler = await readFile(
    new URL("../wrangler.toml.example", import.meta.url),
    "utf8",
  );

  assert.match(wrangler, /crons = \["\*\/30 \* \* \* \*"\]/);
  assert.match(wrangler, /FAILURE_THRESHOLD = "1"/);
  assert.match(wrangler, /HEALTH_TIMEOUT_MS = "90000"/);
  assert.match(wrangler, /COLD_START_RETRY_DELAY_MS = "30000"/);
  assert.doesNotMatch(wrangler, /\*\/5 \* \* \* \*/);
});

const createMemoryKv = (initial = {}) => {
  const values = new Map(Object.entries(initial));
  return {
    values,
    async get(key, type) {
      const value = values.get(key);
      if (value === undefined) return null;
      return type === "json" ? JSON.parse(value) : value;
    },
    async put(key, value) {
      values.set(key, value);
    },
  };
};

const createMemoryCoordinator = () => {
  const leases = new Set();
  return {
    idFromName(name) {
      return name;
    },
    get(id) {
      return {
        async fetch(_url, options = {}) {
          if (options.method === "DELETE") {
            leases.delete(id);
            return Response.json({ released: true });
          }
          const acquired = !leases.has(id);
          if (acquired) leases.add(id);
          return Response.json({ acquired });
        },
      };
    },
  };
};

const createMemoryDurableStorage = () => {
  const values = new Map();
  return {
    values,
    async get(key) {
      return values.get(key);
    },
    async put(key, value) {
      values.set(key, value);
    },
    async delete(key) {
      values.delete(key);
    },
    async transaction(callback) {
      return callback(this);
    },
  };
};

test("incident text removes control characters and common credential/PII shapes", () => {
  const sanitized = sanitizeIncidentText(
    "Bearer secret-token\nuser@example.com token=abc123 cookie=session-value",
  );

  assert.doesNotMatch(sanitized, /secret-token|user@example\.com|abc123|session-value/);
  assert.match(sanitized, /\[REDACTED/);
  assert.doesNotMatch(sanitized, /[\r\n]/);
});

test("health transition alerts once after two failures and recovers once", () => {
  const first = evaluateHealthTransition(
    null,
    { healthy: false, check: "API readiness", route: "GET /api/ops/health/ready", statusCode: 503 },
    new Date("2026-09-04T10:41:00.000Z"),
    2,
  );
  assert.equal(first.event, null);
  assert.equal(first.state.status, "pending_failure");

  const second = evaluateHealthTransition(
    first.state,
    { healthy: false, check: "API readiness", route: "GET /api/ops/health/ready", statusCode: 503 },
    new Date("2026-09-04T10:46:00.000Z"),
    2,
  );
  assert.equal(second.event.type, "failure");
  assert.equal(second.state.status, "failure");
  assert.match(second.state.incidentId, /^INC-\d{8}-\d{4}$/);

  const repeated = evaluateHealthTransition(
    second.state,
    { healthy: false, check: "API readiness", route: "GET /api/ops/health/ready", statusCode: 503 },
    new Date("2026-09-04T10:51:00.000Z"),
    2,
  );
  assert.equal(repeated.event, null);
  assert.equal(repeated.state.incidentId, second.state.incidentId);

  const recovered = evaluateHealthTransition(
    repeated.state,
    { healthy: true, check: "all", route: "GET / + readiness", statusCode: 200 },
    new Date("2026-09-04T10:56:00.000Z"),
    2,
  );
  assert.equal(recovered.event.type, "recovered");
  assert.equal(recovered.event.incidentId, second.state.incidentId);
  assert.equal(recovered.state.status, "healthy");

  const stillHealthy = evaluateHealthTransition(
    recovered.state,
    { healthy: true, check: "all", route: "GET / + readiness", statusCode: 200 },
    new Date("2026-09-04T11:01:00.000Z"),
    2,
  );
  assert.equal(stillHealthy.event, null);
});

test("Telegram messages follow the fixed incident structure without invented root cause", () => {
  const failure = buildFailureMessage({
    incidentId,
    route: "GET /api/ops/health/ready",
    check: "API readiness",
    statusCode: 503,
    consecutiveFailures: 2,
    startedAt: "2026-09-04T10:41:00.000Z",
  });
  const recovery = buildRecoveryMessage({
    incidentId,
    recoveredAt: "2026-09-04T10:56:00.000Z",
    durationMs: 15 * 60 * 1000,
  });

  for (const label of [
    "Kết luận:",
    "Tin cậy:",
    "Root cause:",
    "Ảnh hưởng:",
    "Cách xử lý:",
    "Kiểm chứng:",
    "PR:",
    "AI:",
  ]) {
    assert.match(failure, new RegExp(label));
  }
  assert.match(failure, /Chưa xác định/);
  assert.match(recovery, /RECOVERED/);
  assert.match(recovery, /INC-20260904-1046/);
});

test("Telegram callback rejects an invalid webhook secret before dispatch", async () => {
  const kv = createMemoryKv();
  let calls = 0;
  const request = new Request("https://watchdog.example/telegram/webhook", {
    method: "POST",
    headers: { [["x-telegram-bot-api", "secret", "token"].join("-")]: "wrong" },
    body: JSON.stringify({ callback_query: { id: "cb-1" } }),
  });
  const response = await handleTelegramWebhook(request, {
    INCIDENT_STATE: kv,
    [["TELEGRAM", "WEBHOOK", "SECRET"].join("_")]: "expected",
  }, {
    fetchImpl: async () => {
      calls += 1;
      return new Response(null, { status: 204 });
    },
  });

  assert.equal(response.status, 401);
  assert.equal(calls, 0);
});

test("edge rejects an invalid Telegram webhook before the singleton coordinator", async () => {
  let coordinatorCalls = 0;
  const response = await worker.fetch(new Request(
    "https://watchdog.example/telegram/webhook",
    {
      method: "POST",
      headers: { [["x-telegram-bot-api", "secret", "token"].join("-")]: "wrong" },
      body: "{}",
    },
  ), {
    [["TELEGRAM", "WEBHOOK", "SECRET"].join("_")]: "expected",
    INCIDENT_COORDINATOR: {
      idFromName: () => "singleton",
      get: () => ({
        async fetch() {
          coordinatorCalls += 1;
          return Response.json({ ok: true });
        },
      }),
    },
  });

  assert.equal(response.status, 401);
  assert.equal(coordinatorCalls, 0);
});

test("Telegram callback fails closed when the webhook secret is not configured", async () => {
  const response = await handleTelegramWebhook(new Request(
    "https://watchdog.example/telegram/webhook",
    { method: "POST", body: "{}" },
  ), {
    INCIDENT_STATE: createMemoryKv(),
  });

  assert.equal(response.status, 503);
});

test("Durable Object state stays authoritative when the KV mirror is unavailable", async () => {
  const storage = createMemoryDurableStorage();
  const coordinator = new IncidentCoordinator({ storage }, {
    INCIDENT_STATE: {
      async put() {
        throw new Error("KV unavailable");
      },
    },
  });
  const stateStore = coordinator.stateEnv().INCIDENT_STATE;

  await stateStore.put("production-health-state-v1", JSON.stringify({ status: "healthy" }));

  assert.equal(
    await storage.get("production-health-state-v1"),
    JSON.stringify({ status: "healthy" }),
  );
});

test("an ambiguous remediation lease is never reacquired solely because it is old", async () => {
  const storage = createMemoryDurableStorage();
  const coordinator = new IncidentCoordinator({ storage }, {});
  const request = () => new Request("https://incident-coordinator/remediation-lease", {
    method: "POST",
  });

  const first = await coordinator.fetch(request());
  await storage.put("remediation-lease", {
    status: "reserved",
    updatedAt: Date.now() - 60 * 60 * 1000,
  });
  const second = await coordinator.fetch(request());

  assert.equal((await first.json()).acquired, true);
  assert.equal((await second.json()).acquired, false);
});

test("production probe uses only the fixed client and readiness surfaces", async () => {
  const calls = [];
  const result = await probeProduction({
    HEALTH_TIMEOUT_MS: "5000",
    HEALTHCHECK_URL: "https://attacker.example/private",
  }, {
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      if (String(url).endsWith("/api/ops/health/ready")) {
        return Response.json({
          success: true,
          database: "ready",
          lifecycle: "ready",
          privateField: "discarded",
        });
      }
      return new Response("<!doctype html><title>HT Coaching</title>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    },
  });

  assert.equal(result.healthy, true);
  assert.deepEqual(calls.map(({ url }) => url).sort(), [
    "https://api.htcoachingweb.io.vn/api/ops/health/ready",
    "https://htcoachingweb.io.vn/",
  ]);
  assert.equal(calls.every(({ options }) => options.redirect === "manual"), true);
  assert.equal(calls.some(({ url }) => url.includes("attacker.example")), false);
});

test("production probe retries a sleeping backend once after a bounded cold-start delay", async () => {
  let readinessCalls = 0;
  const waits = [];
  const result = await probeProduction({
    HEALTH_TIMEOUT_MS: "90000",
    COLD_START_RETRY_DELAY_MS: "30000",
  }, {
    waitImpl: async (milliseconds) => waits.push(milliseconds),
    fetchImpl: async (url) => {
      if (url === "https://htcoachingweb.io.vn/") {
        return new Response("<!doctype html>", { status: 200 });
      }
      readinessCalls += 1;
      return readinessCalls === 1
        ? new Response("starting", { status: 503 })
        : Response.json({ success: true, database: "ready", lifecycle: "ready" });
    },
  });

  assert.equal(result.healthy, true);
  assert.equal(readinessCalls, 2);
  assert.deepEqual(waits, [30_000]);
});

test("authorized investigate callback dispatches the matching incident only once", async () => {
  const kv = createMemoryKv({
    "production-health-state-v1": JSON.stringify({
      status: "failure",
      incidentId,
      telegramMessageId: 42,
      acknowledged: false,
      remediationDispatchedAt: null,
      consecutiveFailures: 2,
      lastFailure: {
        check: "API readiness",
        route: "GET /api/ops/health/ready",
        statusCode: 503,
        reason: "unexpected_status",
      },
    }),
  });
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).startsWith("https://api.github.com/")) {
      return new Response(null, { status: 204 });
    }
    return Response.json({ ok: true });
  };
  const env = {
    INCIDENT_STATE: kv,
    INCIDENT_COORDINATOR: createMemoryCoordinator(),
    [["TELEGRAM", "BOT", "TOKEN"].join("_")]: "bot-token",
    TELEGRAM_CHAT_ID: "-10001",
    [["TELEGRAM", "WEBHOOK", "SECRET"].join("_")]: "webhook-secret",
    TELEGRAM_ALLOWED_USER_IDS: "12345",
    [["GITHUB", "DISPATCH", "TOKEN"].join("_")]: "github-token",
  };
  const callbackBody = {
    callback_query: {
      id: "cb-1",
      from: { id: 12345 },
      message: { message_id: 42, chat: { id: -10001 } },
      data: `investigate:${incidentId}`,
    },
  };
  const makeRequest = (body) => new Request(
    "https://watchdog.example/telegram/webhook",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [["x-telegram-bot-api", "secret", "token"].join("-")]: "webhook-secret",
      },
      body: JSON.stringify(body),
    },
  );

  const mismatchedMessage = await handleTelegramWebhook(makeRequest({
    callback_query: {
      ...callbackBody.callback_query,
      id: "cb-wrong-message",
      message: { message_id: 41, chat: { id: -10001 } },
    },
  }), env, {
    fetchImpl,
    now: new Date("2026-09-04T10:49:00.000Z"),
  });
  assert.equal(mismatchedMessage.status, 409);
  assert.equal(calls.some(({ url }) => url.startsWith("https://api.github.com/")), false);

  const first = await handleTelegramWebhook(makeRequest(callbackBody), env, {
    fetchImpl,
    now: new Date("2026-09-04T10:50:00.000Z"),
  });
  const second = await handleTelegramWebhook(makeRequest({
    callback_query: { ...callbackBody.callback_query, id: "cb-2" },
  }), env, {
    fetchImpl,
    now: new Date("2026-09-04T10:51:00.000Z"),
  });

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  const githubCalls = calls.filter(({ url }) => url.startsWith("https://api.github.com/"));
  assert.equal(githubCalls.length, 1);
  assert.deepEqual(JSON.parse(githubCalls[0].options.body), {
    ref: "main",
    inputs: {
      incident_id: incidentId,
      telegram_message_id: "42",
      incident_context: JSON.stringify({
        check: "api-readiness",
        route: "GET /api/ops/health/ready",
        statusCode: 503,
        reason: "unexpected_status",
        consecutiveFailures: 2,
      }),
    },
  });
  const saved = await kv.get("production-health-state-v1", "json");
  assert.equal(saved.remediationDispatchedAt, "2026-09-04T10:50:00.000Z");
});

test("concurrent investigate callbacks share one incident lease", async () => {
  const kv = createMemoryKv({
    "production-health-state-v1": JSON.stringify({
      status: "failure",
      incidentId,
      telegramMessageId: 42,
      alertedAt: "2026-09-04T10:46:00.000Z",
      consecutiveFailures: 2,
      remediationDispatchedAt: null,
      lastFailure: {
        check: "API readiness",
        route: "GET /api/ops/health/ready",
        statusCode: 503,
        reason: "unexpected_status",
      },
    }),
  });
  let dispatches = 0;
  const fetchImpl = async (url) => {
    if (String(url).startsWith("https://api.github.com/")) {
      dispatches += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return new Response(null, { status: 204 });
    }
    return Response.json({ ok: true });
  };
  const env = {
    INCIDENT_STATE: kv,
    INCIDENT_COORDINATOR: createMemoryCoordinator(),
    [["TELEGRAM", "BOT", "TOKEN"].join("_")]: "bot-token",
    TELEGRAM_CHAT_ID: "-10001",
    [["TELEGRAM", "WEBHOOK", "SECRET"].join("_")]: "webhook-secret",
    TELEGRAM_ALLOWED_USER_IDS: "12345",
    [["GITHUB", "DISPATCH", "TOKEN"].join("_")]: "github-token",
  };
  const requestFor = (id) => new Request("https://watchdog.example/telegram/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [["x-telegram-bot-api", "secret", "token"].join("-")]: "webhook-secret",
    },
    body: JSON.stringify({
      callback_query: {
        id,
        from: { id: 12345 },
        message: { message_id: 42, chat: { id: -10001 } },
        data: `investigate:${incidentId}`,
      },
    }),
  });

  const responses = await Promise.all([
    handleTelegramWebhook(requestFor("cb-race-1"), env, { fetchImpl }),
    handleTelegramWebhook(requestFor("cb-race-2"), env, { fetchImpl }),
  ]);

  assert.deepEqual(responses.map((response) => response.status), [200, 200]);
  assert.equal(dispatches, 1);
});

test("a delayed remediation dispatch cannot resurrect a recovered incident", async () => {
  const kv = createMemoryKv({
    "production-health-state-v1": JSON.stringify({
      status: "failure",
      incidentId,
      telegramMessageId: 42,
      alertedAt: "2026-09-04T10:46:00.000Z",
      firstFailureAt: "2026-09-04T10:41:00.000Z",
      consecutiveFailures: 2,
      notificationSentAt: "2026-09-04T10:46:01.000Z",
      remediationDispatchedAt: null,
      lastFailure: {
        check: "API readiness",
        route: "GET /api/ops/health/ready",
        statusCode: 503,
        reason: "unexpected_status",
      },
    }),
  });
  let signalGithubStarted;
  let releaseGithub;
  const githubStarted = new Promise((resolve) => { signalGithubStarted = resolve; });
  const githubRelease = new Promise((resolve) => { releaseGithub = resolve; });
  const fetchImpl = async (url) => {
    if (String(url).startsWith("https://api.github.com/")) {
      signalGithubStarted();
      await githubRelease;
      return new Response(null, { status: 204 });
    }
    if (url === "https://htcoachingweb.io.vn/") {
      return new Response("<!doctype html>", { status: 200 });
    }
    if (url === "https://api.htcoachingweb.io.vn/api/ops/health/ready") {
      return Response.json({ success: true, database: "ready", lifecycle: "ready" });
    }
    return Response.json({ ok: true, result: { message_id: 42 } });
  };
  const env = {
    INCIDENT_STATE: kv,
    INCIDENT_COORDINATOR: createMemoryCoordinator(),
    [["TELEGRAM", "BOT", "TOKEN"].join("_")]: "bot-token",
    TELEGRAM_CHAT_ID: "-10001",
    [["TELEGRAM", "WEBHOOK", "SECRET"].join("_")]: "webhook-secret",
    TELEGRAM_ALLOWED_USER_IDS: "12345",
    [["GITHUB", "DISPATCH", "TOKEN"].join("_")]: "github-token",
    FAILURE_THRESHOLD: "2",
    HEALTH_TIMEOUT_MS: "5000",
  };
  const callback = handleTelegramWebhook(new Request(
    "https://watchdog.example/telegram/webhook",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [["x-telegram-bot-api", "secret", "token"].join("-")]: "webhook-secret",
      },
      body: JSON.stringify({
        callback_query: {
          id: "cb-delayed",
          from: { id: 12345 },
          message: { message_id: 42, chat: { id: -10001 } },
          data: `investigate:${incidentId}`,
        },
      }),
    },
  ), env, {
    fetchImpl,
    now: new Date("2026-09-04T10:49:00.000Z"),
  });
  await githubStarted;

  await runScheduledCheck(env, {
    fetchImpl,
    now: new Date("2026-09-04T10:51:00.000Z"),
  });
  releaseGithub();
  await callback;

  const finalState = await kv.get("production-health-state-v1", "json");
  assert.equal(finalState.status, "healthy");
  assert.equal(finalState.lastIncidentId, incidentId);
  assert.equal(finalState.recoveryNotificationSentAt, "2026-09-04T10:51:00.000Z");
});

test("a lease granted after recovery cannot reserve or dispatch a stale incident", async () => {
  const kv = createMemoryKv({
    "production-health-state-v1": JSON.stringify({
      status: "failure",
      incidentId,
      telegramMessageId: 42,
      alertedAt: "2026-09-04T10:46:00.000Z",
      firstFailureAt: "2026-09-04T10:41:00.000Z",
      consecutiveFailures: 2,
      notificationSentAt: "2026-09-04T10:46:01.000Z",
      remediationDispatchedAt: null,
      lastFailure: {
        check: "API readiness",
        route: "GET /api/ops/health/ready",
        statusCode: 503,
        reason: "unexpected_status",
      },
    }),
  });
  let signalLeaseStarted;
  let releaseLease;
  let leaseReleased = false;
  let githubDispatches = 0;
  const leaseStarted = new Promise((resolve) => { signalLeaseStarted = resolve; });
  const leaseRelease = new Promise((resolve) => { releaseLease = resolve; });
  const coordinator = {
    idFromName: (name) => name,
    get: () => ({
      async fetch(_url, options = {}) {
        if (options.method === "POST") {
          signalLeaseStarted();
          await leaseRelease;
          return Response.json({ acquired: true });
        }
        if (options.method === "DELETE") leaseReleased = true;
        return Response.json({ updated: true });
      },
    }),
  };
  const fetchImpl = async (url) => {
    if (String(url).startsWith("https://api.github.com/")) {
      githubDispatches += 1;
      return new Response(null, { status: 204 });
    }
    if (url === "https://htcoachingweb.io.vn/") {
      return new Response("<!doctype html>", { status: 200 });
    }
    if (url === "https://api.htcoachingweb.io.vn/api/ops/health/ready") {
      return Response.json({ success: true, database: "ready", lifecycle: "ready" });
    }
    return Response.json({ ok: true, result: { message_id: 42 } });
  };
  const env = {
    INCIDENT_STATE: kv,
    INCIDENT_COORDINATOR: coordinator,
    [["TELEGRAM", "BOT", "TOKEN"].join("_")]: "bot-token",
    TELEGRAM_CHAT_ID: "-10001",
    [["TELEGRAM", "WEBHOOK", "SECRET"].join("_")]: "webhook-secret",
    TELEGRAM_ALLOWED_USER_IDS: "12345",
    [["GITHUB", "DISPATCH", "TOKEN"].join("_")]: "github-token",
  };
  const callback = handleTelegramWebhook(new Request(
    "https://watchdog.example/telegram/webhook",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [["x-telegram-bot-api", "secret", "token"].join("-")]: "webhook-secret",
      },
      body: JSON.stringify({
        callback_query: {
          id: "cb-lease-delayed",
          from: { id: 12345 },
          message: { message_id: 42, chat: { id: -10001 } },
          data: `investigate:${incidentId}`,
        },
      }),
    },
  ), env, { fetchImpl });
  await leaseStarted;

  await runScheduledCheck(env, {
    fetchImpl,
    now: new Date("2026-09-04T10:51:00.000Z"),
  });
  releaseLease();
  const response = await callback;

  const finalState = await kv.get("production-health-state-v1", "json");
  assert.equal(response.status, 409);
  assert.equal(githubDispatches, 0);
  assert.equal(leaseReleased, true);
  assert.equal(finalState.status, "healthy");
  assert.equal(finalState.remediationDispatchStatus, undefined);
});

test("notification completion merges into newer incident state", async () => {
  const kv = createMemoryKv({
    "production-health-state-v1": JSON.stringify({
      status: "failure",
      incidentId,
      consecutiveFailures: 2,
      firstFailureAt: "2026-09-04T10:41:00.000Z",
      alertedAt: "2026-09-04T10:46:00.000Z",
      acknowledged: false,
      lastFailure: {
        healthy: false,
        check: "API readiness",
        route: "GET /api/ops/health/ready",
        statusCode: 503,
        reason: "unexpected_status",
      },
    }),
  });
  let signalTelegramStarted;
  let releaseTelegram;
  const telegramStarted = new Promise((resolve) => { signalTelegramStarted = resolve; });
  const telegramRelease = new Promise((resolve) => { releaseTelegram = resolve; });
  const fetchImpl = async (url) => {
    if (String(url).startsWith("https://api.telegram.org/")) {
      signalTelegramStarted();
      await telegramRelease;
      return Response.json({ ok: true, result: { message_id: 42 } });
    }
    return new Response("unavailable", { status: 503 });
  };
  const env = {
    INCIDENT_STATE: kv,
    [["TELEGRAM", "BOT", "TOKEN"].join("_")]: "bot-token",
    TELEGRAM_CHAT_ID: "-10001",
    FAILURE_THRESHOLD: "2",
  };
  const scheduled = runScheduledCheck(env, {
    fetchImpl,
    now: new Date("2026-09-04T10:51:00.000Z"),
  });
  await telegramStarted;
  const duringSend = await kv.get("production-health-state-v1", "json");
  duringSend.acknowledged = true;
  duringSend.acknowledgedAt = "2026-09-04T10:50:00.000Z";
  await kv.put("production-health-state-v1", JSON.stringify(duringSend));
  releaseTelegram();
  await scheduled;

  const finalState = await kv.get("production-health-state-v1", "json");
  assert.equal(finalState.status, "failure");
  assert.equal(finalState.acknowledged, true);
  assert.equal(finalState.notificationSentAt, "2026-09-04T10:51:00.000Z");
  assert.equal(finalState.failureNotificationStatus, "sent");
});

test("close callback acknowledges but never changes failure into recovery", async () => {
  const kv = createMemoryKv({
    "production-health-state-v1": JSON.stringify({
      status: "failure",
      incidentId,
      telegramMessageId: 42,
      acknowledged: false,
    }),
  });
  const request = new Request("https://watchdog.example/telegram/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [["x-telegram-bot-api", "secret", "token"].join("-")]: "webhook-secret",
    },
    body: JSON.stringify({
      callback_query: {
        id: "cb-close",
        from: { id: 12345 },
        message: { message_id: 42, chat: { id: -10001 } },
        data: `ack:${incidentId}`,
      },
    }),
  });
  const response = await handleTelegramWebhook(request, {
    INCIDENT_STATE: kv,
    [["TELEGRAM", "BOT", "TOKEN"].join("_")]: "bot-token",
    TELEGRAM_CHAT_ID: "-10001",
    [["TELEGRAM", "WEBHOOK", "SECRET"].join("_")]: "webhook-secret",
    TELEGRAM_ALLOWED_USER_IDS: "12345",
  }, {
    fetchImpl: async () => Response.json({ ok: true }),
    now: new Date("2026-09-04T10:55:00.000Z"),
  });

  assert.equal(response.status, 200);
  const saved = await kv.get("production-health-state-v1", "json");
  assert.equal(saved.status, "failure");
  assert.equal(saved.acknowledged, true);
  assert.equal(saved.acknowledgedAt, "2026-09-04T10:55:00.000Z");
});

test("scheduled check delivers a missed failure before its recovery", async () => {
  const kv = createMemoryKv({
    "production-health-state-v1": JSON.stringify({
      status: "failure",
      incidentId,
      consecutiveFailures: 2,
      firstFailureAt: "2026-09-04T10:41:00.000Z",
      alertedAt: "2026-09-04T10:46:00.000Z",
      lastFailure: {
        healthy: false,
        check: "API readiness",
        route: "GET /api/ops/health/ready",
        statusCode: 503,
        reason: "unexpected_status",
      },
    }),
  });
  let telegramAttempts = 0;
  const telegramMessages = [];
  const fetchImpl = async (url, options = {}) => {
    if (url === "https://htcoachingweb.io.vn/") {
      return new Response("<!doctype html>", { status: 200 });
    }
    if (url === "https://api.htcoachingweb.io.vn/api/ops/health/ready") {
      return Response.json({ success: true, database: "ready", lifecycle: "ready" });
    }
    if (String(url).startsWith("https://api.telegram.org/")) {
      telegramAttempts += 1;
      telegramMessages.push(JSON.parse(options.body).text);
      return telegramAttempts === 1
        ? new Response("unavailable", { status: 503 })
        : Response.json({ ok: true, result: { message_id: 42 } });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };
  const env = {
    INCIDENT_STATE: kv,
    [["TELEGRAM", "BOT", "TOKEN"].join("_")]: "test-bot-token",
    TELEGRAM_CHAT_ID: "123",
    FAILURE_THRESHOLD: "2",
    HEALTH_TIMEOUT_MS: "5000",
  };

  await assert.rejects(
    runScheduledCheck(env, {
      fetchImpl,
      now: new Date("2026-09-04T10:56:00.000Z"),
    }),
    /telegram_sendMessage_failed/,
  );
  const pending = await kv.get("production-health-state-v1", "json");
  assert.equal(pending.status, "healthy");
  assert.equal(pending.notificationSentAt, undefined);
  assert.deepEqual(
    pending.notificationOutbox.map(({ type, incidentId: queuedIncidentId }) =>
      `${type}:${queuedIncidentId}`),
    [`failure:${incidentId}`, `recovered:${incidentId}`],
  );

  await runScheduledCheck(env, {
    fetchImpl,
    now: new Date("2026-09-04T11:01:00.000Z"),
  });
  const recovered = await kv.get("production-health-state-v1", "json");
  assert.equal(telegramAttempts, 3);
  assert.match(telegramMessages[1], /🚨 \[SEV-2\]/);
  assert.match(telegramMessages[2], /✅ \[RECOVERED\]/);
  assert.equal("pendingRecovery" in recovered, false);
  assert.equal(recovered.recoveryNotificationSentAt, "2026-09-04T11:01:00.000Z");
});

test("Telegram outage retains recovery but never blocks the production probe", async () => {
  const kv = createMemoryKv({
    "production-health-state-v1": JSON.stringify({
      status: "healthy",
      consecutiveFailures: 0,
      lastIncidentId: incidentId,
      notificationSentAt: "2026-09-04T10:46:00.000Z",
      pendingRecovery: {
        type: "recovered",
        incidentId,
        recoveredAt: "2026-09-04T10:56:00.000Z",
        durationMs: 15 * 60 * 1000,
      },
    }),
  });
  let productionProbes = 0;
  const fetchImpl = async (url) => {
    if (String(url).startsWith("https://api.telegram.org/")) {
      return new Response("unavailable", { status: 503 });
    }
    productionProbes += 1;
    return new Response("unexpected", { status: 503 });
  };

  await assert.rejects(
    runScheduledCheck({
      INCIDENT_STATE: kv,
      [["TELEGRAM", "BOT", "TOKEN"].join("_")]: "test-bot-token",
      TELEGRAM_CHAT_ID: "123",
    }, {
      fetchImpl,
      now: new Date("2026-09-04T11:01:00.000Z"),
    }),
    /telegram_sendMessage_failed/,
  );
  const retained = await kv.get("production-health-state-v1", "json");
  assert.equal(productionProbes, 2);
  assert.equal(retained.status, "pending_failure");
  assert.equal(retained.pendingRecovery.incidentId, incidentId);
});

test("Telegram outage preserves recovery before a later incident failure", async () => {
  const kv = createMemoryKv({
    "production-health-state-v1": JSON.stringify({
      status: "healthy",
      consecutiveFailures: 0,
      lastIncidentId: incidentId,
      notificationSentAt: "2026-09-04T10:46:00.000Z",
      pendingRecovery: {
        type: "recovered",
        incidentId,
        recoveredAt: "2026-09-04T10:56:00.000Z",
        durationMs: 15 * 60 * 1000,
      },
    }),
  });
  let telegramAvailable = false;
  let productionHealthy = false;
  const telegramMessages = [];
  const fetchImpl = async (url, options = {}) => {
    if (String(url).startsWith("https://api.telegram.org/")) {
      telegramMessages.push(JSON.parse(options.body).text);
      return telegramAvailable
        ? Response.json({ ok: true, result: { message_id: 77 } })
        : new Response("unavailable", { status: 503 });
    }
    if (productionHealthy && url === "https://htcoachingweb.io.vn/") {
      return new Response("<!doctype html>", { status: 200 });
    }
    if (productionHealthy && url === "https://api.htcoachingweb.io.vn/api/ops/health/ready") {
      return Response.json({ success: true, database: "ready", lifecycle: "ready" });
    }
    return new Response("unexpected", { status: 503 });
  };
  const env = {
    INCIDENT_STATE: kv,
    [["TELEGRAM", "BOT", "TOKEN"].join("_")]: "test-bot-token",
    TELEGRAM_CHAT_ID: "123",
    FAILURE_THRESHOLD: "2",
  };

  await assert.rejects(
    runScheduledCheck(env, {
      fetchImpl,
      now: new Date("2026-09-04T11:01:00.000Z"),
    }),
    /telegram_sendMessage_failed/,
  );
  await assert.rejects(
    runScheduledCheck(env, {
      fetchImpl,
      now: new Date("2026-09-04T11:06:00.000Z"),
    }),
    /telegram_sendMessage_failed/,
  );

  const queued = await kv.get("production-health-state-v1", "json");
  assert.equal(queued.status, "failure");
  assert.equal(queued.incidentId, "INC-20260904-1106");
  assert.equal(queued.pendingRecovery.incidentId, incidentId);
  assert.equal(queued.pendingFailureNotification.incidentId, "INC-20260904-1106");

  productionHealthy = true;
  await assert.rejects(
    runScheduledCheck(env, {
      fetchImpl,
      now: new Date("2026-09-04T11:11:00.000Z"),
    }),
    /telegram_sendMessage_failed/,
  );
  const fullyQueued = await kv.get("production-health-state-v1", "json");
  assert.deepEqual(
    fullyQueued.notificationOutbox.map(({ type, incidentId: queuedIncidentId }) =>
      `${type}:${queuedIncidentId}`),
    [
      `recovered:${incidentId}`,
      "failure:INC-20260904-1106",
      "recovered:INC-20260904-1106",
    ],
  );

  telegramAvailable = true;
  await runScheduledCheck(env, {
    fetchImpl,
    now: new Date("2026-09-04T11:16:00.000Z"),
  });

  assert.match(telegramMessages.at(-3), /✅ \[RECOVERED\]/);
  assert.match(telegramMessages.at(-2), /🚨 \[SEV-2\]/);
  assert.match(telegramMessages.at(-1), /✅ \[RECOVERED\]/);
  const delivered = await kv.get("production-health-state-v1", "json");
  assert.equal("pendingRecovery" in delivered, false);
  assert.equal("pendingFailureNotification" in delivered, false);
  assert.equal(delivered.lastIncidentId, "INC-20260904-1106");
  assert.deepEqual(delivered.notificationOutbox, []);
});

test("stale notification claims are reclaimed without losing failure-recovery order", async () => {
  const kv = createMemoryKv({
    "production-health-state-v1": JSON.stringify({
      status: "healthy",
      consecutiveFailures: 0,
      lastIncidentId: incidentId,
      pendingFailureNotification: {
        type: "failure",
        incidentId,
        healthy: false,
        check: "API readiness",
        route: "GET /api/ops/health/ready",
        statusCode: 503,
        reason: "unexpected_status",
        consecutiveFailures: 2,
        startedAt: "2026-09-04T10:41:00.000Z",
      },
      failureNotificationStatus: "sending",
      failureNotificationAttemptedAt: "2026-09-04T10:55:00.000Z",
      failureNotificationAttemptId: "abandoned-attempt",
      pendingRecovery: {
        type: "recovered",
        incidentId,
        recoveredAt: "2026-09-04T10:56:00.000Z",
        durationMs: 15 * 60 * 1000,
      },
    }),
  });
  const telegramMessages = [];
  const fetchImpl = async (url, options = {}) => {
    if (url === "https://htcoachingweb.io.vn/") {
      return new Response("<!doctype html>", { status: 200 });
    }
    if (url === "https://api.htcoachingweb.io.vn/api/ops/health/ready") {
      return Response.json({ success: true, database: "ready", lifecycle: "ready" });
    }
    telegramMessages.push(JSON.parse(options.body).text);
    return Response.json({ ok: true, result: { message_id: 42 } });
  };
  const env = {
    INCIDENT_STATE: kv,
    [["TELEGRAM", "BOT", "TOKEN"].join("_")]: "test-bot-token",
    TELEGRAM_CHAT_ID: "123",
  };

  await runScheduledCheck(env, {
    fetchImpl,
    now: new Date("2026-09-04T11:01:00.000Z"),
  });
  await runScheduledCheck(env, {
    fetchImpl,
    now: new Date("2026-09-04T11:06:00.000Z"),
  });

  const finalState = await kv.get("production-health-state-v1", "json");
  assert.equal(telegramMessages.length, 2);
  assert.match(telegramMessages[0], /🚨 \[SEV-2\]/);
  assert.match(telegramMessages[1], /✅ \[RECOVERED\]/);
  assert.equal(finalState.failureNotificationStatus, "sent");
  assert.equal(finalState.recoveryNotificationStatus, "sent");
  assert.equal(finalState.pendingFailureNotification, undefined);
  assert.equal(finalState.pendingRecovery, undefined);
});
