import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { setTimeout as wait } from "node:timers/promises";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { getRuntimeIdentity } from "../../observability/metrics.js";
import { parseChatRequest } from "../../utils/aiChat.js";

export const STAGING_AI_ACCEPTANCE_COLLECTION = "staging_ai_acceptance_claims";
export const STAGING_AI_ACCEPTANCE_HEADER = "X-Staging-Ai-Acceptance";
export const STAGING_AI_ACCEPTANCE_REQUEST_ID_HEADER = "X-Staging-Ai-Request-Id";
export const STAGING_AI_ACCEPTANCE_PREFIX = "AC009-PREFIX";
export const STAGING_AI_ACCEPTANCE_LATE_SUFFIX = "AC009-LATE-SUFFIX";
export const STAGING_AI_ACCEPTANCE_RESPONSE = `${STAGING_AI_ACCEPTANCE_PREFIX}\n\nĐây là phản hồi tổng hợp dành riêng cho kiểm tra staging. ${"Nội dung cố định này chỉ kiểm tra truyền dữ liệu và thao tác dừng; không phải tư vấn sức khỏe. ".repeat(24)}\n\n${STAGING_AI_ACCEPTANCE_LATE_SUFFIX}`;

const ISSUER = "htcoaching:staging-ai-acceptance:v2";
const AUDIENCE = "htcoaching:staging-ai-acceptance";
const KEY_DOMAIN = "htcoaching:staging-ai-acceptance:hs256:v2";
const APPROVED_API_ORIGIN = "https://htcoachingweb-staging.onrender.com";
const APPROVED_CLIENT_ORIGIN = "https://staging--htcoachingweb.netlify.app";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OBJECT_ID = /^[0-9a-f]{24}$/i;
const SHA = /^[0-9a-f]{40}$/;
const DIGEST = /^[0-9a-f]{64}$/;
const MAX_ISSUER_CLOCK_LEAD_SECONDS = 5;
const PURPOSES = new Map([
  ["live_kb_provider", ["ai_chat", "observe_only"]], ["paced_conversation", ["ai_chat", "paced_response"]],
  ["stop", ["ai_chat", "paced_response"]], ["provider_failure_retry", ["ai_chat", "provider_failure_before_llm"]],
  ["recovery_retry", ["ai_chat", "observe_only"]], ["provider_failure_edit", ["ai_chat", "provider_failure_before_llm"]],
  ["recovery_edit", ["ai_chat", "observe_only"]], ["kb_search_root", ["kb_search", "observe_only"]],
  ["kb_search_variant", ["kb_search", "observe_only"]],
]);
const TERMINAL_OUTCOMES = new Set(["completed", "failed", "aborted", "duplicate", "rejected"]);
const reject = () => Object.assign(new Error("Staging AI acceptance rejected"), { code: "STAGING_AI_ACCEPTANCE_REJECTED", status: 403 });
const runControlId = (runId) => runId;
const signingKey = (env) => {
  if (typeof env.JWT_SECRET !== "string" || env.JWT_SECRET.length < 16) throw reject();
  return createHmac("sha256", env.JWT_SECRET).update(KEY_DOMAIN).digest();
};
const canonicalJson = (value) => Array.isArray(value) ? `[${value.map(canonicalJson).join(",")}]` : value && typeof value === "object" ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}` : JSON.stringify(value);
const digest = (value) => createHash("sha256").update(canonicalJson(value)).digest("hex");
const chatBinding = (request) => {
  if (!UUID.test(request?.requestId || "")) throw reject();
  const parsed = parseChatRequest(request);
  if (parsed.error || parsed.value.image) throw reject();
  const {
    message,
    conversationId,
    retryOfMessageId,
    requestId,
    context,
    structuredAction,
  } = parsed.value;
  if (conversationId !== null && !OBJECT_ID.test(conversationId)) throw reject();
  if (retryOfMessageId !== null && !OBJECT_ID.test(retryOfMessageId)) throw reject();
  return {
    conversationId,
    requestId,
    payloadDigest: digest({
      message,
      conversationId,
      retryOfMessageId,
      requestId,
      context,
      structuredAction,
    }),
  };
};
const searchBinding = (request) => {
  const requestId = request?.requestId;
  const query = String(request?.query?.q || "").trim();
  const limit = request?.query?.limit === undefined ? null : String(request.query.limit);
  const threshold = request?.query?.threshold === undefined ? null : String(request.query.threshold);
  if (!UUID.test(requestId || "") || !query || query.length > 500) throw reject();
  return { conversationId: null, requestId, payloadDigest: digest({ q: query, limit, threshold }) };
};
const bindingFor = (action, request) => action === "ai_chat" ? chatBinding(request) : action === "kb_search" ? searchBinding(request) : (() => { throw reject(); })();
const validPurpose = (purpose, action, mode) => { const allowed = PURPOSES.get(purpose); return allowed?.[0] === action && allowed?.[1] === mode; };
const validateClaims = (claims, now) => {
  const keys = ["iss", "aud", "jti", "iat", "exp", "releaseSha", "runtimeInstanceId", "runId", "actorId", "action", "purpose", "requestId", "payloadDigest", "mode", "conversationId"];
  if (!claims || typeof claims !== "object" || Array.isArray(claims) || Object.keys(claims).length !== keys.length || Object.keys(claims).some((key) => !keys.includes(key)) || claims.iss !== ISSUER || claims.aud !== AUDIENCE || !UUID.test(claims.jti) || claims.jti === claims.runId || !UUID.test(claims.runtimeInstanceId) || !UUID.test(claims.runId) || !OBJECT_ID.test(claims.actorId) || !SHA.test(claims.releaseSha) || !UUID.test(claims.requestId) || !DIGEST.test(claims.payloadDigest) || !validPurpose(claims.purpose, claims.action, claims.mode) || (claims.conversationId !== null && !OBJECT_ID.test(claims.conversationId)) || !Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.exp) || claims.iat < 0 || claims.iat > now + MAX_ISSUER_CLOCK_LEAD_SECONDS || claims.exp <= now || claims.exp <= claims.iat || claims.exp - claims.iat > 300) throw reject();
};
const currentRuntime = (runtimeIdentity = getRuntimeIdentity()) => {
  if (!UUID.test(runtimeIdentity?.runtimeInstanceId || "") || !SHA.test(runtimeIdentity?.runtimeReleaseSha || "")) throw reject();
  return runtimeIdentity;
};
const decodeCapability = (token, env) => {
  if (typeof token !== "string" || token.length > 4096) throw reject();
  const verified = jwt.verify(token, signingKey(env), {
    algorithms: ["HS256"],
    issuer: ISSUER,
    audience: AUDIENCE,
    complete: true,
  });
  if (verified.header.typ !== "JWT" || Object.keys(verified.header).some((key) => !["alg", "typ"].includes(key))) throw reject();
  validateClaims(verified.payload, Math.floor(Date.now() / 1000));
  return Object.freeze(verified.payload);
};

export function issueStagingAiAcceptance({ request, actorId, releaseSha, runtimeInstanceId = getRuntimeIdentity().runtimeInstanceId, runId, action, purpose, mode, jti = randomUUID(), ttlSeconds = 300 }, { env = process.env } = {}) {
  const now = Math.floor(Date.now() / 1000); const binding = bindingFor(action, request);
  const claims = { iss: ISSUER, aud: AUDIENCE, jti, iat: now, exp: now + ttlSeconds, releaseSha, runtimeInstanceId, runId, actorId, action, purpose, requestId: binding.requestId, payloadDigest: binding.payloadDigest, mode, conversationId: binding.conversationId };
  validateClaims(claims, now); return jwt.sign(claims, signingKey(env), { algorithm: "HS256" });
}

export function verifyStagingAiAcceptance(token, { request, actorId, origin, env = process.env, connection = mongoose.connection, runtimeIdentity } = {}) {
  try {
    const runtime = currentRuntime(runtimeIdentity);
    if (env.APP_ENV !== "staging" || env.STAGING_AI_ACCEPTANCE_ENABLED !== "true" || connection.readyState !== 1 || connection.db?.databaseName !== "htcoaching_staging" || env.PUBLIC_API_ORIGIN !== APPROVED_API_ORIGIN || env.CLIENT_URL !== APPROVED_CLIENT_ORIGIN || origin !== env.CLIENT_URL || !SHA.test(env.RENDER_GIT_COMMIT || "") || env.RENDER_GIT_COMMIT !== runtime.runtimeReleaseSha || !OBJECT_ID.test(actorId || "")) throw reject();
    const claims = decodeCapability(token, env);
    const binding = bindingFor(claims.action, request);
    if (claims.releaseSha !== env.RENDER_GIT_COMMIT || claims.releaseSha !== runtime.runtimeReleaseSha || claims.runtimeInstanceId !== runtime.runtimeInstanceId || claims.actorId !== actorId || claims.conversationId !== binding.conversationId || claims.requestId !== binding.requestId || !timingSafeEqual(Buffer.from(claims.payloadDigest, "hex"), Buffer.from(binding.payloadDigest, "hex"))) throw reject();
    return Object.freeze(claims);
  } catch { throw reject(); }
}

// The trusted runner reserves each JTI before sending it. The backend can then
// admit with a no-upsert CAS, so cleanup cannot reopen a replay window.
export async function registerStagingAiAcceptanceCapability(token, {
  connection = mongoose.connection,
  env = process.env,
} = {}) {
  try {
    const claims = decodeCapability(token, env);
    if (env.APP_ENV !== "staging" || env.STAGING_AI_ACCEPTANCE_ENABLED !== "true" ||
        env.PUBLIC_API_ORIGIN !== APPROVED_API_ORIGIN || env.CLIENT_URL !== APPROVED_CLIENT_ORIGIN ||
        env.RENDER_GIT_COMMIT !== claims.releaseSha || connection.readyState !== 1 ||
        connection.db?.databaseName !== "htcoaching_staging") throw reject();
    const collection = connection.db.collection(STAGING_AI_ACCEPTANCE_COLLECTION);
    const revokedFilter = {
      _id: runControlId(claims.runId),
      recordType: "run",
      runId: claims.runId,
      state: "revoked",
    };
    if (await collection.findOne(revokedFilter, { projection: { _id: 1 }, timeoutMS: 1000 })) {
      throw reject();
    }
    await collection.insertOne({
      _id: claims.jti,
      recordType: "capability",
      receiptVersion: 2,
      receiptState: "issued",
      runId: claims.runId,
      actorId: claims.actorId,
      action: claims.action,
      purpose: claims.purpose,
      mode: claims.mode,
      requestId: claims.requestId,
      conversationId: claims.conversationId,
      payloadDigest: claims.payloadDigest,
      releaseSha: claims.releaseSha,
      runtimeInstanceId: claims.runtimeInstanceId,
      issuedAt: new Date(),
      expiresAt: new Date(claims.exp * 1000),
      status: "issued",
    }, { timeoutMS: 1000 });
    if (await collection.findOne(revokedFilter, { projection: { _id: 1 }, timeoutMS: 1000 })) {
      await collection.deleteOne({
        _id: claims.jti,
        recordType: "capability",
        receiptVersion: 2,
        receiptState: "issued",
        runId: claims.runId,
      }, { timeoutMS: 1000 });
      throw reject();
    }
    return claims;
  } catch {
    throw reject();
  }
}

export async function claimStagingAiAcceptance(token, options = {}) {
  const claims = verifyStagingAiAcceptance(token, options); const connection = options.connection || mongoose.connection;
  try {
    const collection = connection.db.collection(STAGING_AI_ACCEPTANCE_COLLECTION);
    const revokedFilter = {
      _id: runControlId(claims.runId),
      recordType: "run",
      runId: claims.runId,
      state: "revoked",
    };
    if (await collection.findOne(revokedFilter, { projection: { _id: 1 }, timeoutMS: 1000 })) throw reject();
    const expectedEmail = claims.action === "kb_search" ? `ac009-admin.${claims.runId}@example.invalid` : `ac009.${claims.runId}@example.invalid`;
    const expectedRole = claims.action === "kb_search" ? "admin" : "user";
    const actor = await connection.db.collection("users").findOne({ _id: new mongoose.Types.ObjectId(claims.actorId), role: expectedRole, email: expectedEmail }, { projection: { _id: 1 }, timeoutMS: 1000 });
    if (!actor) throw reject();
    const admitted = await collection.updateOne({
      _id: claims.jti,
      recordType: "capability",
      receiptVersion: 2,
      receiptState: "issued",
      runId: claims.runId,
      actorId: claims.actorId,
      action: claims.action,
      purpose: claims.purpose,
      mode: claims.mode,
      requestId: claims.requestId,
      conversationId: claims.conversationId,
      payloadDigest: claims.payloadDigest,
      releaseSha: claims.releaseSha,
      runtimeInstanceId: claims.runtimeInstanceId,
      expiresAt: { $gt: new Date() },
    }, {
      $set: { receiptState: "admitted", admittedAt: new Date(), status: "claimed" },
    }, { timeoutMS: 1000 });
    if (admitted.modifiedCount !== 1) throw reject();
    if (await collection.findOne(revokedFilter, { projection: { _id: 1 }, timeoutMS: 1000 })) {
      await settleStagingAiAcceptance(claims, "rejected", { connection });
      throw reject();
    }
    return claims;
  } catch { throw reject(); }
}

export async function revokeStagingAiAcceptanceRun(runId, { connection = mongoose.connection } = {}) {
  if (!UUID.test(runId || "") || connection.readyState !== 1 || connection.db?.databaseName !== "htcoaching_staging") {
    throw reject();
  }
  const result = await connection.db.collection(STAGING_AI_ACCEPTANCE_COLLECTION).updateOne(
    { _id: runControlId(runId), recordType: "run", runId },
    { $setOnInsert: { state: "revoked", revokedAt: new Date() } },
    { upsert: true, timeoutMS: 1000 },
  );
  return result.acknowledged === true;
}

export async function settleStagingAiAcceptance(claims, outcome, { connection = mongoose.connection } = {}) {
  if (!claims || !TERMINAL_OUTCOMES.has(outcome)) throw reject();
  const result = await connection.db.collection(STAGING_AI_ACCEPTANCE_COLLECTION).updateOne({
    _id: claims.jti,
    receiptVersion: 2,
    receiptState: "admitted",
    runId: claims.runId,
    actorId: claims.actorId,
    action: claims.action,
    purpose: claims.purpose,
    mode: claims.mode,
    requestId: claims.requestId,
    payloadDigest: claims.payloadDigest,
    runtimeInstanceId: claims.runtimeInstanceId,
    releaseSha: claims.releaseSha,
  }, { $set: { receiptState: "settled", outcome, settledAt: new Date() } }, { timeoutMS: 1000 });
  return result.modifiedCount === 1;
}

export async function waitForStagingAiAcceptanceRelease(claims, { signal, connection = mongoose.connection } = {}) {
  const collection = connection.db.collection(STAGING_AI_ACCEPTANCE_COLLECTION); const filter = { _id: claims.jti, runId: claims.runId, actorId: claims.actorId, requestId: claims.requestId, releaseSha: claims.releaseSha, runtimeInstanceId: claims.runtimeInstanceId, mode: "paced_response" }; const deadline = Date.now() + 10000;
  const gateSignal = AbortSignal.any([signal || new AbortController().signal, AbortSignal.timeout(10000)]);
  const options = () => ({ signal: gateSignal, timeoutMS: Math.max(1, Math.min(1000, deadline - Date.now())) });
  const mark = async (status) => collection.updateOne({ ...filter, status: { $in: ["claimed", "first_frame", "released"] } }, { $set: { status } }, { timeoutMS: 1000 });
  try {
    const first = await collection.updateOne({ ...filter, status: "claimed" }, { $set: { status: "first_frame" } }, options()); if (first.modifiedCount !== 1) throw reject();
    while (!gateSignal.aborted && Date.now() < deadline) { const record = await collection.findOne(filter, { ...options(), projection: { status: 1 } }); if (gateSignal.aborted || Date.now() >= deadline) break; if (record?.status === "released") return; if (record?.status !== "first_frame") throw reject(); await wait(100, undefined, { signal: gateSignal }); }
    throw reject();
  } catch {
    if (signal?.aborted) { try { await mark("aborted"); } catch {} return; }
    try { await mark(gateSignal.aborted || Date.now() >= deadline ? "timed_out" : "failed"); } catch {}
    throw Object.assign(new Error("Staging acceptance release barrier failed"), { code: "STAGING_AI_ACCEPTANCE_BARRIER_FAILED", isOperational: true });
  }
}
