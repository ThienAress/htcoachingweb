import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { setTimeout as wait } from "node:timers/promises";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { parseChatRequest } from "../../utils/aiChat.js";

export const STAGING_AI_ACCEPTANCE_COLLECTION = "staging_ai_acceptance_claims";
export const STAGING_AI_ACCEPTANCE_PREFIX = "AC009-PREFIX";
export const STAGING_AI_ACCEPTANCE_LATE_SUFFIX = "AC009-LATE-SUFFIX";
export const STAGING_AI_ACCEPTANCE_RESPONSE =
  `${STAGING_AI_ACCEPTANCE_PREFIX}\n\nĐây là phản hồi tổng hợp dành riêng cho kiểm tra staging. ` +
  "Nội dung cố định này chỉ kiểm tra truyền dữ liệu và thao tác dừng; không phải tư vấn sức khỏe. ".repeat(24) +
  `\n\n${STAGING_AI_ACCEPTANCE_LATE_SUFFIX}`;

const ISSUER = "htcoaching:staging-ai-acceptance:v1";
const AUDIENCE = "htcoaching:staging-ai-chat";
const KEY_DOMAIN = "htcoaching:staging-ai-acceptance:hs256:v1";
const APPROVED_API_ORIGIN = "https://htcoachingweb-staging.onrender.com";
const APPROVED_CLIENT_ORIGIN = "https://staging--htcoachingweb.netlify.app";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OBJECT_ID = /^[0-9a-f]{24}$/i;
const SHA = /^[0-9a-f]{40}$/;
const DIGEST = /^[0-9a-f]{64}$/;
const MAX_ISSUER_CLOCK_LEAD_SECONDS = 5;
const MODES = new Set(["paced_response", "provider_failure_before_llm"]);
const CLAIM_KEYS = new Set([
  "iss", "aud", "jti", "iat", "exp", "releaseSha", "runId", "actorId",
  "conversationId", "requestId", "payloadDigest", "mode",
]);
const rejected = () => Object.assign(new Error("Staging AI acceptance rejected"), {
  code: "STAGING_AI_ACCEPTANCE_REJECTED", status: 403,
});

const signingKey = (env) => {
  if (typeof env.JWT_SECRET !== "string" || env.JWT_SECRET.length < 16) throw rejected();
  return createHmac("sha256", env.JWT_SECRET).update(KEY_DOMAIN).digest();
};
const canonicalJson = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
};
const requestBinding = (request) => {
  if (!UUID.test(request?.requestId || "")) throw rejected();
  const parsed = parseChatRequest(request);
  if (parsed.error || parsed.value.image) throw rejected();
  const { message, conversationId, requestId, context } = parsed.value;
  if (conversationId !== null && !OBJECT_ID.test(conversationId)) throw rejected();
  return {
    conversationId, requestId,
    payloadDigest: createHash("sha256")
      .update(canonicalJson({ message, conversationId, requestId, context })).digest("hex"),
  };
};
const validateClaims = (claims, now, { maxIssuerClockLeadSeconds = 0 } = {}) => {
  if (!claims || typeof claims !== "object" || Array.isArray(claims) ||
      Object.keys(claims).length !== CLAIM_KEYS.size ||
      Object.keys(claims).some((key) => !CLAIM_KEYS.has(key)) ||
      [...CLAIM_KEYS].some((key) => !["iat", "exp", "conversationId"].includes(key) &&
        typeof claims[key] !== "string") ||
      (claims.conversationId !== null && typeof claims.conversationId !== "string") ||
      claims.iss !== ISSUER || claims.aud !== AUDIENCE ||
      !UUID.test(claims.jti) || !UUID.test(claims.runId) || !UUID.test(claims.requestId) ||
      !OBJECT_ID.test(claims.actorId) || !SHA.test(claims.releaseSha) ||
      (claims.conversationId !== null && !OBJECT_ID.test(claims.conversationId)) ||
      !DIGEST.test(claims.payloadDigest) || !MODES.has(claims.mode) ||
      !Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.exp) ||
      claims.iat > now + maxIssuerClockLeadSeconds || claims.iat < 0 || claims.exp <= now ||
      claims.exp <= claims.iat || claims.exp - claims.iat > 300) throw rejected();
};

// Operator-only helper; never exposed as an HTTP endpoint or public DTO.
export function issueStagingAiAcceptance({
  request, actorId, releaseSha, runId, mode, jti = randomUUID(), ttlSeconds = 300,
}, { env = process.env } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: ISSUER, aud: AUDIENCE, jti, iat: now, exp: now + ttlSeconds,
    releaseSha, runId, actorId, ...requestBinding(request), mode,
  };
  validateClaims(claims, now);
  return jwt.sign(claims, signingKey(env), { algorithm: "HS256" });
}

export function verifyStagingAiAcceptance(token, {
  request, actorId, origin, env = process.env, connection = mongoose.connection,
}) {
  try {
    if (env.APP_ENV !== "staging" || env.STAGING_AI_ACCEPTANCE_ENABLED !== "true" ||
        connection.readyState !== 1 || connection.db?.databaseName !== "htcoaching_staging" ||
        env.PUBLIC_API_ORIGIN !== APPROVED_API_ORIGIN ||
        env.CLIENT_URL !== APPROVED_CLIENT_ORIGIN || origin !== env.CLIENT_URL ||
        !SHA.test(env.RENDER_GIT_COMMIT || "") || !OBJECT_ID.test(actorId || "") ||
        typeof token !== "string" || token.length > 4096) throw rejected();
    const verified = jwt.verify(token, signingKey(env), {
      algorithms: ["HS256"], issuer: ISSUER, audience: AUDIENCE, complete: true,
    });
    if (verified.header.typ !== "JWT" ||
        Object.keys(verified.header).some((key) => !["alg", "typ"].includes(key))) throw rejected();
    const claims = verified.payload;
    validateClaims(claims, Math.floor(Date.now() / 1000), {
      maxIssuerClockLeadSeconds: MAX_ISSUER_CLOCK_LEAD_SECONDS,
    });
    const binding = requestBinding(request);
    if (claims.releaseSha !== env.RENDER_GIT_COMMIT || claims.actorId !== actorId ||
        claims.conversationId !== binding.conversationId || claims.requestId !== binding.requestId ||
        !timingSafeEqual(Buffer.from(claims.payloadDigest, "hex"), Buffer.from(binding.payloadDigest, "hex"))) {
      throw rejected();
    }
    return Object.freeze(claims);
  } catch {
    // Never expose JWT, request text, connection URI, or library error details.
    throw rejected();
  }
}

export async function claimStagingAiAcceptance(token, options) {
  const claims = verifyStagingAiAcceptance(token, options);
  const connection = options.connection || mongoose.connection;
  try {
    const actor = await connection.db.collection("users").findOne({
      _id: new mongoose.Types.ObjectId(claims.actorId), role: "user",
      email: `ac009.${claims.runId}@example.invalid`,
    }, { projection: { _id: 1, role: 1, email: 1 }, timeoutMS: 1_000 });
    if (!actor) throw rejected();
    // Built-in _id uniqueness is the cross-process replay guard. No index migration.
    await connection.db.collection(STAGING_AI_ACCEPTANCE_COLLECTION).insertOne({
      _id: claims.jti, runId: claims.runId, actorId: claims.actorId,
      requestId: claims.requestId, conversationId: claims.conversationId,
      releaseSha: claims.releaseSha, mode: claims.mode, payloadDigest: claims.payloadDigest,
      createdAt: new Date(), expiresAt: new Date(claims.exp * 1000), status: "claimed",
    }, { timeoutMS: 1_000 });
    return claims;
  } catch {
    throw rejected();
  }
}

// This control state stays internal: the runner owns exact-ID release/cleanup.
// An unreleased barrier must fail, never automatically emit the late suffix.
export async function waitForStagingAiAcceptanceRelease(claims, {
  signal, connection = mongoose.connection,
} = {}) {
  const collection = connection.db.collection(STAGING_AI_ACCEPTANCE_COLLECTION);
  const filter = { _id: claims.jti, runId: claims.runId, actorId: claims.actorId,
    requestId: claims.requestId, releaseSha: claims.releaseSha, mode: "paced_response" };
  const deadline = Date.now() + 10_000;
  const gateSignal = AbortSignal.any([signal || new AbortController().signal, AbortSignal.timeout(10_000)]);
  const options = () => ({ signal: gateSignal, timeoutMS: Math.max(1, Math.min(1_000, deadline - Date.now())) });
  const mark = async (status) => {
    await collection.updateOne({ ...filter, status: { $in: ["claimed", "first_frame", "released"] } },
      { $set: { status } }, { timeoutMS: 1_000 });
  };
  try {
    const first = await collection.updateOne({ ...filter, status: "claimed" },
      { $set: { status: "first_frame" } }, options());
    if (first.modifiedCount !== 1) throw rejected();
    while (!gateSignal.aborted && Date.now() < deadline) {
      const record = await collection.findOne(filter, { ...options(), projection: { status: 1 } });
      if (gateSignal.aborted || Date.now() >= deadline) break;
      if (record?.status === "released") return;
      if (record?.status !== "first_frame") throw rejected();
      await wait(100, undefined, { signal: gateSignal });
    }
    throw rejected();
  } catch {
    if (signal?.aborted) {
      try { await mark("aborted"); } catch { /* Failed acknowledgement remains a failed acceptance. */ }
      return;
    }
    try { await mark(gateSignal.aborted || Date.now() >= deadline ? "timed_out" : "failed"); } catch { /* Fail closed below. */ }
    throw Object.assign(new Error("Staging acceptance release barrier failed"), {
      code: "STAGING_AI_ACCEPTANCE_BARRIER_FAILED", isOperational: true,
    });
  }
}
