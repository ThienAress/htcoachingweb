const STATE_KEY = "production-health-state-v1";
const CLIENT_URL = "https://htcoachingweb.io.vn/";
const READINESS_URL = "https://api.htcoachingweb.io.vn/api/ops/health/ready";
const GITHUB_REPOSITORY = "ThienAress/htcoachingweb";
const GITHUB_WORKFLOW = "incident-remediation.yml";
const MAX_WEBHOOK_BYTES = 16 * 1024;
const MAX_HEALTH_BYTES = 8 * 1024;
const OUTBOUND_TIMEOUT_MS = 10_000;
const NOTIFICATION_CLAIM_TTL_MS = 60_000;

const asBoundedInteger = (value, fallback, minimum, maximum) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
};

export const sanitizeIncidentText = (value, maxLength = 240) =>
  String(value || "")
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[REDACTED_EMAIL]")
    .replace(/\b(token|cookie|authorization|password|secret)=([^\s&]+)/gi, "$1=[REDACTED]")
    .replace(/[\u0000-\u001F\u007F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const incidentIdFor = (date) => {
  const iso = date.toISOString();
  return `INC-${iso.slice(0, 10).replaceAll("-", "")}-${iso.slice(11, 16).replace(":", "")}`;
};

const cleanProbe = (probe) => ({
  healthy: probe?.healthy === true,
  check: sanitizeIncidentText(probe?.check || "Production health", 80),
  route: sanitizeIncidentText(probe?.route || "GET /", 120),
  statusCode: Number.isInteger(probe?.statusCode) ? probe.statusCode : null,
  reason: sanitizeIncidentText(probe?.reason || "unknown", 120),
});

const notificationTracking = (state) => Object.fromEntries(
  [
    "pendingFailureNotification",
    "failureNotificationStatus",
    "failureNotificationAttemptedAt",
    "failureNotificationAttemptId",
    "notificationSentAt",
    "telegramMessageId",
    "pendingRecovery",
    "recoveryNotificationStatus",
    "recoveryNotificationAttemptedAt",
    "recoveryNotificationAttemptId",
    "recoveryNotificationSentAt",
    "notificationOutbox",
  ]
    .filter((field) => state?.[field] !== undefined)
    .map((field) => [field, state[field]]),
);

const notificationKey = (event) => `${event.type}:${event.incidentId}`;

const notificationOutbox = (state) => {
  const queue = Array.isArray(state?.notificationOutbox)
    ? state.notificationOutbox.filter((event) =>
        event &&
        ["failure", "recovered"].includes(event.type) &&
        typeof event.incidentId === "string")
    : [];
  const append = (event) => {
    if (!event || queue.some((queued) => notificationKey(queued) === notificationKey(event))) return;
    queue.push({ ...event });
  };
  append(state?.pendingFailureNotification);
  if (state?.status === "failure" && !state?.notificationSentAt) {
    append({
      type: "failure",
      incidentId: state.incidentId,
      ...state.lastFailure,
      consecutiveFailures: state.consecutiveFailures,
      startedAt: state.firstFailureAt,
    });
  }
  append(state?.pendingRecovery);
  return queue;
};

const enqueueNotification = (state, event) => {
  const queue = notificationOutbox(state);
  if (!queue.some((queued) => notificationKey(queued) === notificationKey(event))) {
    queue.push({ ...event });
  }
  return queue;
};

const pendingRecoveryTracking = (state) => {
  if (!state?.pendingRecovery) return {};
  const pendingRecovery = {
    ...state.pendingRecovery,
    ...(!state.pendingRecovery.failureNotificationSentAt && state.notificationSentAt
      ? { failureNotificationSentAt: state.notificationSentAt }
      : {}),
  };
  return {
    pendingRecovery,
    ...Object.fromEntries(
      [
        "recoveryNotificationStatus",
        "recoveryNotificationAttemptedAt",
        "recoveryNotificationAttemptId",
        "recoveryNotificationSentAt",
      ]
        .filter((field) => state[field] !== undefined)
        .map((field) => [field, state[field]]),
    ),
  };
};

export const evaluateHealthTransition = (
  previous,
  probeInput,
  now = new Date(),
  failureThreshold = 2,
) => {
  const threshold = asBoundedInteger(failureThreshold, 2, 1, 5);
  const probe = cleanProbe(probeInput);
  const prior = previous && typeof previous === "object"
    ? previous
    : { status: "healthy", consecutiveFailures: 0 };
  const checkedAt = now.toISOString();

  if (probe.healthy) {
    if (prior.status === "failure") {
      const startedAt = prior.firstFailureAt || prior.alertedAt || checkedAt;
      const durationMs = Math.max(0, now.getTime() - new Date(startedAt).getTime());
      const recovery = {
        type: "recovered",
        incidentId: prior.incidentId,
        recoveredAt: checkedAt,
        durationMs: Number.isFinite(durationMs) ? durationMs : 0,
        ...(prior.notificationSentAt
          ? { failureNotificationSentAt: prior.notificationSentAt }
          : {}),
      };
      return {
        state: {
          status: "healthy",
          consecutiveFailures: 0,
          lastCheckedAt: checkedAt,
          lastHealthyAt: checkedAt,
          lastIncidentId: prior.incidentId,
          ...notificationTracking(prior),
          pendingRecovery: recovery,
          notificationOutbox: enqueueNotification(prior, recovery),
        },
        event: recovery,
      };
    }
    return {
      state: {
        status: "healthy",
        consecutiveFailures: 0,
        lastCheckedAt: checkedAt,
        lastHealthyAt: checkedAt,
        ...(prior.lastIncidentId ? { lastIncidentId: prior.lastIncidentId } : {}),
        ...notificationTracking(prior),
      },
      event: null,
    };
  }

  if (prior.status === "failure") {
    return {
      state: {
        ...prior,
        consecutiveFailures: (prior.consecutiveFailures || threshold) + 1,
        lastCheckedAt: checkedAt,
        lastFailure: probe,
      },
      event: null,
    };
  }

  const consecutiveFailures = (prior.consecutiveFailures || 0) + 1;
  const firstFailureAt = prior.status === "pending_failure" && prior.firstFailureAt
    ? prior.firstFailureAt
    : checkedAt;
  if (consecutiveFailures < threshold) {
    return {
      state: {
        status: "pending_failure",
        consecutiveFailures,
        firstFailureAt,
        lastCheckedAt: checkedAt,
        lastFailure: probe,
        ...(prior.lastIncidentId ? { lastIncidentId: prior.lastIncidentId } : {}),
        ...notificationTracking(prior),
      },
      event: null,
    };
  }

  const incidentId = incidentIdFor(now);
  const failureNotification = {
    type: "failure",
    incidentId,
    ...probe,
    consecutiveFailures,
    startedAt: firstFailureAt,
  };
  const state = {
    status: "failure",
    incidentId,
    consecutiveFailures,
    firstFailureAt,
    alertedAt: checkedAt,
    lastCheckedAt: checkedAt,
    lastFailure: probe,
    acknowledged: false,
    remediationDispatchedAt: null,
    ...(prior.lastIncidentId ? { lastIncidentId: prior.lastIncidentId } : {}),
    ...pendingRecoveryTracking(prior),
    pendingFailureNotification: failureNotification,
    notificationOutbox: enqueueNotification(prior, failureNotification),
  };
  return {
    state,
    event: failureNotification,
  };
};

const formatDuration = (durationMs) => {
  const totalSeconds = Math.max(0, Math.round(Number(durationMs || 0) / 1000));
  if (totalSeconds < 60) return `${totalSeconds} giây`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds ? `${minutes} phút ${seconds} giây` : `${minutes} phút`;
};

export const buildFailureMessage = (incident) => {
  const route = sanitizeIncidentText(incident.route, 120);
  const check = sanitizeIncidentText(incident.check, 80);
  const status = Number.isInteger(incident.statusCode)
    ? `HTTP ${incident.statusCode}`
    : "network/timeout";
  const failures = asBoundedInteger(incident.consecutiveFailures, 2, 1, 999);
  return [
    `🚨 [SEV-2] ${check} thất bại — ${route}`,
    `👥 Chưa xác định người dùng · ${failures} lần fail liên tiếp · production`,
    `📌 ${sanitizeIncidentText(incident.incidentId, 32)} · deploy chưa xác định`,
    "",
    "Kết luận: Cần điều tra",
    `Tin cậy: Cao — health probe đã fail ${failures} lần liên tiếp`,
    "",
    "Root cause:",
    "Chưa xác định — watchdog không suy đoán nguyên nhân từ một health response.",
    "",
    "Ảnh hưởng:",
    `${check} không đạt (${status}); phạm vi người dùng bị ảnh hưởng chưa xác định.`,
    "",
    "Cách xử lý:",
    "Kiểm tra run/deploy log và bấm “Điều tra & tạo Draft PR” nếu cần agent hỗ trợ.",
    "",
    "Kiểm chứng:",
    `• Health check: FAIL (${status})`,
    `• Retry: ${failures}/${failures}`,
    "• Build: Chưa chạy",
    "",
    "PR: Chưa tạo",
    `⏱ Bắt đầu ${sanitizeIncidentText(incident.startedAt, 40)} · đang diễn ra`,
    "💰 AI: Chưa phát sinh · Runner: 0 phút",
  ].join("\n");
};

export const buildRecoveryMessage = (incident) => [
  "✅ [RECOVERED] Production health đã phục hồi",
  "👥 Phạm vi người dùng chưa xác định · production",
  `📌 ${sanitizeIncidentText(incident.incidentId, 32)} · recovery tự động quan sát`,
  "",
  "Kết luận: Health probe đã trở lại bình thường",
  "Tin cậy: Cao — readiness và client probe cùng PASS",
  "",
  "Root cause:",
  "Chưa xác định — recovery không thay thế điều tra root cause.",
  "",
  "Ảnh hưởng:",
  "Cửa sổ degraded đã kết thúc theo probe; vẫn cần review log nếu là SEV-2.",
  "",
  "Cách xử lý:",
  "Giữ theo dõi và chỉ đóng incident sau owner review.",
  "",
  "Kiểm chứng:",
  "• Client: PASS",
  "• API readiness: PASS",
  "• Build: Không chạy trong watchdog",
  "",
  "PR: Không thay đổi",
  `⏱ Phục hồi ${sanitizeIncidentText(incident.recoveredAt, 40)} · ${formatDuration(incident.durationMs)}`,
  "💰 AI: Không phát sinh · Runner: 0 phút",
].join("\n");

const parseJsonLimited = async (request, maxBytes = MAX_WEBHOOK_BYTES) => {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > maxBytes) throw new Error("payload_too_large");
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new Error("payload_too_large");
  }
  return JSON.parse(text);
};

const timingSafeEqual = (left, right) => {
  const a = String(left || "");
  const b = String(right || "");
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return difference === 0;
};

const allowedUserIds = (env) => new Set(
  String(env.TELEGRAM_ALLOWED_USER_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => /^\d+$/.test(value)),
);

const telegramApi = async (env, method, payload, fetchImpl) => {
  if (!String(env.TELEGRAM_BOT_TOKEN || "")) throw new Error("telegram_not_configured");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OUTBOUND_TIMEOUT_MS);
  try {
    const response = await fetchImpl(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      },
    );
    if (!response.ok) throw new Error(`telegram_${method}_failed`);
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
};

const callbackKeyboard = (incidentId) => ({
  inline_keyboard: [
    [{
      text: "🔗 Xem sự cố",
      url: `https://github.com/${GITHUB_REPOSITORY}/actions/workflows/${GITHUB_WORKFLOW}`,
    }],
    [
      {
        text: "🛠 Điều tra & tạo Draft PR",
        callback_data: `investigate:${incidentId}`,
      },
      { text: "❌ Đóng", callback_data: `ack:${incidentId}` },
    ],
  ],
});

const sendIncidentMessage = async (env, text, incidentId, fetchImpl) => {
  const result = await telegramApi(env, "sendMessage", {
    chat_id: env.TELEGRAM_CHAT_ID,
    text,
    disable_web_page_preview: true,
    ...(incidentId ? { reply_markup: callbackKeyboard(incidentId) } : {}),
  }, fetchImpl);
  return result?.result?.message_id || null;
};

const staleNotificationClaim = (event, now) => {
  if (event?.status !== "sending") return false;
  const attemptedAt = Date.parse(String(event?.attemptedAt || ""));
  return !Number.isFinite(attemptedAt) ||
    now.getTime() - attemptedAt >= NOTIFICATION_CLAIM_TTL_MS;
};

const putMergedState = async (env, merge) => {
  const latest = await env.INCIDENT_STATE.get(STATE_KEY, "json");
  if (!latest || typeof latest !== "object") return latest;
  const next = merge({ ...latest });
  if (!next) return latest;
  await env.INCIDENT_STATE.put(STATE_KEY, JSON.stringify(next));
  return next;
};

const deliverPendingNotifications = async (env, stateInput, now, fetchImpl) => {
  if (!stateInput || typeof stateInput !== "object") return stateInput;
  let state = await env.INCIDENT_STATE.get(STATE_KEY, "json") || stateInput;
  const normalizedQueue = notificationOutbox(state);
  if (JSON.stringify(state.notificationOutbox || []) !== JSON.stringify(normalizedQueue)) {
    state = { ...state, notificationOutbox: normalizedQueue };
    await env.INCIDENT_STATE.put(STATE_KEY, JSON.stringify(state));
  }

  while (state.notificationOutbox?.length) {
    const head = state.notificationOutbox[0];
    if (head.status === "sending" && !staleNotificationClaim(head, now)) return state;
    const key = notificationKey(head);
    const attemptId = crypto.randomUUID();
    state = await putMergedState(env, (latest) => {
      const queue = notificationOutbox(latest);
      const current = queue[0];
      if (!current || notificationKey(current) !== key ||
          (current.status === "sending" && !staleNotificationClaim(current, now))) {
        return null;
      }
      queue[0] = {
        ...current,
        status: "sending",
        attemptedAt: now.toISOString(),
        attemptId,
      };
      return { ...latest, notificationOutbox: queue };
    });
    const claimed = state?.notificationOutbox?.[0];
    if (!claimed || notificationKey(claimed) !== key || claimed.attemptId !== attemptId) {
      return state;
    }

    try {
      const messageId = await sendIncidentMessage(
        env,
        claimed.type === "failure"
          ? buildFailureMessage(claimed)
          : buildRecoveryMessage(claimed),
        claimed.type === "failure" ? claimed.incidentId : null,
        fetchImpl,
      );
      state = await putMergedState(env, (latest) => {
        const queue = notificationOutbox(latest);
        const current = queue[0];
        if (!current || notificationKey(current) !== key || current.attemptId !== attemptId) {
          return null;
        }
        queue.shift();
        if (claimed.type === "failure") {
          const recoveryIndex = queue.findIndex((event) =>
            event.type === "recovered" && event.incidentId === claimed.incidentId);
          if (recoveryIndex >= 0) {
            queue[recoveryIndex] = {
              ...queue[recoveryIndex],
              failureNotificationSentAt: now.toISOString(),
            };
          }
          if (latest.pendingFailureNotification?.incidentId === claimed.incidentId) {
            delete latest.pendingFailureNotification;
          }
          latest.failureNotificationStatus = "sent";
          if (latest.incidentId === claimed.incidentId) {
            latest.notificationSentAt = now.toISOString();
            if (messageId) latest.telegramMessageId = messageId;
          }
        } else {
          if (latest.pendingRecovery?.incidentId === claimed.incidentId) {
            delete latest.pendingRecovery;
          }
          latest.recoveryNotificationStatus = "sent";
          latest.recoveryNotificationSentAt = now.toISOString();
        }
        delete latest.failureNotificationAttemptId;
        delete latest.recoveryNotificationAttemptId;
        return { ...latest, notificationOutbox: queue };
      });
    } catch (error) {
      await putMergedState(env, (latest) => {
        const queue = notificationOutbox(latest);
        const current = queue[0];
        if (current && notificationKey(current) === key && current.attemptId === attemptId) {
          queue[0] = { ...current };
          delete queue[0].status;
          delete queue[0].attemptedAt;
          delete queue[0].attemptId;
        }
        return { ...latest, notificationOutbox: queue };
      });
      throw error;
    }
  }
  return state;
};

const dispatchRemediation = async (
  env,
  incidentId,
  incident,
  telegramMessageId,
  fetchImpl,
) => {
  if (!String(env.GITHUB_DISPATCH_TOKEN || "")) {
    throw new Error("github_dispatch_not_configured");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OUTBOUND_TIMEOUT_MS);
  try {
    const response = await fetchImpl(
      `https://api.github.com/repos/${GITHUB_REPOSITORY}/actions/workflows/${GITHUB_WORKFLOW}/dispatches`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
          "User-Agent": "htcoaching-production-watchdog/1.0",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          ref: "main",
          inputs: {
            incident_id: incidentId,
            telegram_message_id: String(telegramMessageId),
            incident_context: JSON.stringify({
              check: incident.check === "Client document"
                ? "client-document"
                : "api-readiness",
              route: incident.route,
              statusCode: incident.statusCode,
              reason: incident.reason,
              consecutiveFailures: incident.consecutiveFailures,
            }),
          },
        }),
        signal: controller.signal,
      },
    );
    if (response.status !== 204) throw new Error("github_dispatch_failed");
  } finally {
    clearTimeout(timeout);
  }
};

const callbackResponse = (status = 200) => new Response(
  JSON.stringify({ ok: status >= 200 && status < 300 }),
  { status, headers: { "content-type": "application/json" } },
);

export class IncidentCoordinator {
  constructor(state, env) {
    this.storage = state.storage;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/scheduled" && request.method === "POST") {
      await runScheduledCheck(this.stateEnv());
      return callbackResponse();
    }
    if (url.pathname === "/telegram/webhook") {
      return handleTelegramWebhook(request, this.stateEnv());
    }
    if (url.pathname !== "/remediation-lease") return callbackResponse(404);
    if (request.method === "DELETE") {
      await this.storage.delete("remediation-lease");
      return new Response(JSON.stringify({ released: true }), {
        headers: { "content-type": "application/json" },
      });
    }
    if (request.method === "PUT" || request.method === "PATCH") {
      await this.storage.put("remediation-lease", {
        status: request.method === "PUT" ? "dispatched" : "unknown",
        updatedAt: Date.now(),
      });
      return new Response(JSON.stringify({ updated: true }), {
        headers: { "content-type": "application/json" },
      });
    }
    if (request.method !== "POST") return callbackResponse(405);
    let acquired = false;
    await this.storage.transaction(async (transaction) => {
      const existing = await transaction.get("remediation-lease");
      if (existing) return;
      await transaction.put("remediation-lease", {
        status: "reserved",
        updatedAt: Date.now(),
      });
      acquired = true;
    });
    return new Response(JSON.stringify({ acquired }), {
      headers: { "content-type": "application/json" },
    });
  }

  stateEnv() {
    const storage = this.storage;
    const kv = this.env.INCIDENT_STATE;
    const stateStore = {
      async get(key, type) {
        let value = await storage.get(key);
        if (value === undefined && kv?.get) {
          value = await kv.get(key);
          if (value !== null && value !== undefined) await storage.put(key, value);
        }
        if (value === null || value === undefined) return null;
        const serialized = typeof value === "string" ? value : JSON.stringify(value);
        return type === "json" ? JSON.parse(serialized) : serialized;
      },
      async put(key, value) {
        await storage.put(key, value);
        if (kv?.put) await kv.put(key, value).catch(() => {});
      },
    };
    return { ...this.env, INCIDENT_STATE: stateStore };
  }
}

const remediationLease = async (env, state, method = "POST") => {
  if (!env.INCIDENT_COORDINATOR?.idFromName || !env.INCIDENT_COORDINATOR?.get) {
    throw new Error("incident_coordinator_not_configured");
  }
  const leaseName = `${state.incidentId}:${state.alertedAt || state.firstFailureAt || "unknown"}`;
  const objectId = env.INCIDENT_COORDINATOR.idFromName(leaseName);
  const response = await env.INCIDENT_COORDINATOR.get(objectId).fetch(
    "https://incident-coordinator/remediation-lease",
    { method },
  );
  if (!response.ok) throw new Error("incident_coordinator_failed");
  return response.json();
};

export const handleTelegramWebhook = async (
  request,
  env,
  { fetchImpl = fetch, now = new Date() } = {},
) => {
  if (request.method !== "POST") return callbackResponse(405);
  if (!String(env.TELEGRAM_WEBHOOK_SECRET || "")) return callbackResponse(503);
  if (!timingSafeEqual(
    request.headers.get("x-telegram-bot-api-secret-token"),
    env.TELEGRAM_WEBHOOK_SECRET,
  )) {
    return callbackResponse(401);
  }

  let update;
  try {
    update = await parseJsonLimited(request);
  } catch {
    return callbackResponse(400);
  }
  const callback = update?.callback_query;
  const chatId = String(callback?.message?.chat?.id || "");
  const userId = String(callback?.from?.id || "");
  const telegramMessageId = Number(callback?.message?.message_id);
  if (
    !callback?.id ||
    !Number.isSafeInteger(telegramMessageId) ||
    telegramMessageId <= 0 ||
    !timingSafeEqual(chatId, env.TELEGRAM_CHAT_ID) ||
    !allowedUserIds(env).has(userId)
  ) {
    return callbackResponse(403);
  }
  const actionMatch = /^(investigate|ack):(INC-\d{8}-\d{4})$/.exec(
    String(callback.data || ""),
  );
  if (!actionMatch) return callbackResponse(400);
  const [, action, incidentId] = actionMatch;
  const state = await env.INCIDENT_STATE.get(STATE_KEY, "json");
  if (state?.status !== "failure" ||
      state?.incidentId !== incidentId ||
      state?.telegramMessageId !== telegramMessageId) {
    await telegramApi(env, "answerCallbackQuery", {
      callback_query_id: callback.id,
      text: "Incident này không còn active.",
    }, fetchImpl);
    return callbackResponse(409);
  }

  if (action === "investigate") {
    if (!state.remediationDispatchedAt) {
      if (!String(env.GITHUB_DISPATCH_TOKEN || "")) {
        await telegramApi(env, "answerCallbackQuery", {
          callback_query_id: callback.id,
          text: "Chưa thể gửi workflow. Kiểm tra cấu hình vận hành.",
          show_alert: true,
        }, fetchImpl);
        return callbackResponse(503);
      }
      const lease = await remediationLease(env, state);
      if (!lease.acquired) {
        await telegramApi(env, "answerCallbackQuery", {
          callback_query_id: callback.id,
          text: "Yêu cầu điều tra đã được giữ chỗ hoặc gửi trước đó; hãy kiểm tra GitHub Actions.",
        }, fetchImpl);
        return callbackResponse();
      }
      const latest = await env.INCIDENT_STATE.get(STATE_KEY, "json");
      if (latest?.status !== "failure" ||
          latest.incidentId !== incidentId ||
          latest.telegramMessageId !== telegramMessageId) {
        await remediationLease(env, state, "DELETE").catch(() => {});
        await telegramApi(env, "answerCallbackQuery", {
          callback_query_id: callback.id,
          text: "Incident đã phục hồi trước khi workflow được gửi.",
        }, fetchImpl);
        return callbackResponse(409);
      }
      latest.remediationDispatchStatus = "reserved";
      latest.remediationDispatchAttemptedAt = now.toISOString();
      await env.INCIDENT_STATE.put(STATE_KEY, JSON.stringify(latest));
      try {
        await dispatchRemediation(env, incidentId, {
          ...latest.lastFailure,
          consecutiveFailures: latest.consecutiveFailures,
        }, telegramMessageId, fetchImpl);
      } catch {
        await remediationLease(env, state, "PATCH").catch(() => {});
        const latest = await env.INCIDENT_STATE.get(STATE_KEY, "json");
        if (latest?.status === "failure" && latest.incidentId === incidentId) {
          latest.remediationDispatchStatus = "unknown";
          await env.INCIDENT_STATE.put(STATE_KEY, JSON.stringify(latest));
        }
        await telegramApi(env, "answerCallbackQuery", {
          callback_query_id: callback.id,
          text: "Không xác nhận được dispatch. Kiểm tra GitHub Actions trước khi thử thủ công.",
          show_alert: true,
        }, fetchImpl);
        return callbackResponse(502);
      }
      await remediationLease(env, state, "PUT");
      const finalState = await env.INCIDENT_STATE.get(STATE_KEY, "json");
      if (finalState?.status === "failure" && finalState.incidentId === incidentId) {
        finalState.remediationDispatchStatus = "dispatched";
        finalState.remediationDispatchedAt = now.toISOString();
        await env.INCIDENT_STATE.put(STATE_KEY, JSON.stringify(finalState));
      }
    }
    await telegramApi(env, "answerCallbackQuery", {
      callback_query_id: callback.id,
      text: state.remediationDispatchedAt
        ? "Đã gửi yêu cầu điều tra. Workflow sẽ chỉ tạo Draft PR nếu đủ evidence."
        : "Đang gửi yêu cầu điều tra.",
    }, fetchImpl);
    return callbackResponse();
  }

  state.acknowledged = true;
  state.acknowledgedAt = now.toISOString();
  await env.INCIDENT_STATE.put(STATE_KEY, JSON.stringify(state));
  await telegramApi(env, "answerCallbackQuery", {
    callback_query_id: callback.id,
    text: "Đã xác nhận thông báo; watchdog vẫn chờ health recovery.",
  }, fetchImpl);
  return callbackResponse();
};

const readResponseTextLimited = async (response, maxBytes = MAX_HEALTH_BYTES) => {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > maxBytes) throw new Error("health_response_too_large");
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new Error("health_response_too_large");
  }
  return text;
};

const probeUrl = async (url, { fetchImpl, timeoutMs, expectJson }) => {
  if (![CLIENT_URL, READINESS_URL].includes(url)) throw new Error("health_url_not_allowed");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        Accept: expectJson ? "application/json" : "text/html",
        "User-Agent": "htcoaching-production-watchdog/1.0",
      },
    });
    if (response.status !== 200) {
      return { healthy: false, statusCode: response.status, reason: "unexpected_status" };
    }
    if (!expectJson) return { healthy: true, statusCode: 200, reason: "ok" };
    const text = await readResponseTextLimited(response);
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      return { healthy: false, statusCode: 200, reason: "invalid_json" };
    }
    const healthy = payload?.success === true &&
      payload?.database === "ready" &&
      payload?.lifecycle === "ready";
    return {
      healthy,
      statusCode: 200,
      reason: healthy ? "ready" : "readiness_contract_failed",
    };
  } catch (error) {
    return {
      healthy: false,
      statusCode: null,
      reason: error?.name === "AbortError" ? "timeout" : "network_error",
    };
  } finally {
    clearTimeout(timeout);
  }
};

export const probeProduction = async (
  env,
  {
    fetchImpl = fetch,
    waitImpl = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  } = {},
) => {
  const timeoutMs = asBoundedInteger(env.HEALTH_TIMEOUT_MS, 60_000, 5_000, 90_000);
  let [client, readiness] = await Promise.all([
    probeUrl(CLIENT_URL, { fetchImpl, timeoutMs, expectJson: false }),
    probeUrl(READINESS_URL, { fetchImpl, timeoutMs, expectJson: true }),
  ]);
  const coldStartRetryDelayMs = asBoundedInteger(
    env.COLD_START_RETRY_DELAY_MS,
    0,
    0,
    60_000,
  );
  if (coldStartRetryDelayMs > 0 && (!client.healthy || !readiness.healthy)) {
    await waitImpl(coldStartRetryDelayMs);
    [client, readiness] = await Promise.all([
      client.healthy
        ? client
        : probeUrl(CLIENT_URL, { fetchImpl, timeoutMs, expectJson: false }),
      readiness.healthy
        ? readiness
        : probeUrl(READINESS_URL, { fetchImpl, timeoutMs, expectJson: true }),
    ]);
  }
  if (!client.healthy) {
    return { ...client, check: "Client document", route: "GET /" };
  }
  if (!readiness.healthy) {
    return {
      ...readiness,
      check: "API readiness",
      route: "GET /api/ops/health/ready",
    };
  }
  return {
    healthy: true,
    statusCode: 200,
    reason: "ready",
    check: "all",
    route: "GET / + readiness",
  };
};

export const runScheduledCheck = async (
  env,
  { fetchImpl = fetch, waitImpl, now = new Date() } = {},
) => {
  if (!env.INCIDENT_STATE?.get || !env.INCIDENT_STATE?.put) {
    throw new Error("incident_state_not_configured");
  }
  if (!String(env.TELEGRAM_CHAT_ID || "") || !String(env.TELEGRAM_BOT_TOKEN || "")) {
    throw new Error("telegram_not_configured");
  }
  const stored = await env.INCIDENT_STATE.get(STATE_KEY, "json");
  let pendingDeliveryError = null;
  try {
    await deliverPendingNotifications(env, stored, now, fetchImpl);
  } catch (error) {
    pendingDeliveryError = error;
  }
  const probe = await probeProduction(env, { fetchImpl, waitImpl });
  const previous = await env.INCIDENT_STATE.get(STATE_KEY, "json");
  const transition = evaluateHealthTransition(
    previous,
    probe,
    now,
    asBoundedInteger(env.FAILURE_THRESHOLD, 2, 1, 5),
  );
  await env.INCIDENT_STATE.put(STATE_KEY, JSON.stringify(transition.state));
  if (!pendingDeliveryError) {
    transition.state = await deliverPendingNotifications(
      env,
      transition.state,
      now,
      fetchImpl,
    );
  }
  if (pendingDeliveryError) throw pendingDeliveryError;
  return { probe, transition };
};

export default {
  async scheduled(_event, env, context) {
    if (!env.INCIDENT_COORDINATOR?.idFromName || !env.INCIDENT_COORDINATOR?.get) {
      throw new Error("incident_coordinator_not_configured");
    }
    const objectId = env.INCIDENT_COORDINATOR.idFromName(STATE_KEY);
    const response = env.INCIDENT_COORDINATOR.get(objectId).fetch(
      "https://incident-coordinator/scheduled",
      { method: "POST" },
    ).then((result) => {
      if (!result.ok) throw new Error("scheduled_coordinator_failed");
    });
    context.waitUntil(response);
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/telegram/webhook") {
      if (request.method !== "POST") return callbackResponse(405);
      if (!String(env.TELEGRAM_WEBHOOK_SECRET || "")) return callbackResponse(503);
      if (!timingSafeEqual(
        request.headers.get("x-telegram-bot-api-secret-token"),
        env.TELEGRAM_WEBHOOK_SECRET,
      )) {
        return callbackResponse(401);
      }
      if (!env.INCIDENT_COORDINATOR?.idFromName || !env.INCIDENT_COORDINATOR?.get) {
        return callbackResponse(503);
      }
      const objectId = env.INCIDENT_COORDINATOR.idFromName(STATE_KEY);
      return env.INCIDENT_COORDINATOR.get(objectId).fetch(request);
    }
    if (url.pathname === "/health" && request.method === "GET") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("Not found", { status: 404 });
  },
};
