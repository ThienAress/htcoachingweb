import { createHmac, randomUUID } from "node:crypto";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import {
  claimStagingAiAcceptance,
  issueStagingAiAcceptance,
  verifyStagingAiAcceptance,
  waitForStagingAiAcceptanceRelease,
  STAGING_AI_ACCEPTANCE_COLLECTION,
} from "../stagingAiAcceptance.service.js";
import { prepareStagingAiAcceptance } from "../../../middlewares/stagingAiAcceptance.js";

let mongo;
let connection;
let actorId;
let runId;
const env = {
  JWT_SECRET: "synthetic-acceptance-signing-secret",
  APP_ENV: "staging",
  STAGING_AI_ACCEPTANCE_ENABLED: "true",
  CLIENT_URL: "https://staging--htcoachingweb.netlify.app",
  PUBLIC_API_ORIGIN: "https://htcoachingweb-staging.onrender.com",
  RENDER_GIT_COMMIT: "a".repeat(40),
};
const fixture = (overrides = {}) => {
  const request = { message: "Xin chào", requestId: randomUUID() };
  const claims = {
    request, actorId,
    releaseSha: env.RENDER_GIT_COMMIT, runId, mode: "paced_response",
    ...overrides,
  };
  return {
    token: issueStagingAiAcceptance(claims, { env }),
    options: { request: claims.request, actorId: claims.actorId, origin: env.CLIENT_URL, env, connection },
    claims,
  };
};

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  connection = await mongoose.createConnection(mongo.getUri(), { dbName: "htcoaching_staging" }).asPromise();
});
beforeEach(async () => {
  actorId = new mongoose.Types.ObjectId().toString();
  runId = randomUUID();
  await connection.db.collection("users").insertOne({ _id: new mongoose.Types.ObjectId(actorId),
    role: "user", email: `ac009.${runId}@example.invalid` });
});
afterEach(async () => {
  await connection.db.collection(STAGING_AI_ACCEPTANCE_COLLECTION).deleteMany({});
  await connection.db.collection("users").deleteMany({});
});
afterAll(async () => {
  await connection?.close();
  await mongo?.stop();
});

describe("staging AI request capability", () => {
  it("leaves a request without the optional field completely untouched", async () => {
    const req = { body: { message: "Normal chat" } };
    const next = vi.fn();
    await prepareStagingAiAcceptance(req, {}, next);
    expect({ req, calls: next.mock.calls }).toEqual({
      req: { body: { message: "Normal chat" } }, calls: [[]],
    });
  });

  it.each([
    ["APP_ENV", "production"], ["STAGING_AI_ACCEPTANCE_ENABLED", "false"],
    ["STAGING_AI_ACCEPTANCE_ENABLED", "TRUE"], ["CLIENT_URL", "https://wrong.example"],
    ["PUBLIC_API_ORIGIN", "https://htcoachingweb.onrender.com"],
    ["RENDER_GIT_COMMIT", "b".repeat(40)], ["RENDER_GIT_COMMIT", "a".repeat(7)],
    ["JWT_SECRET", ""],
  ])("rejects a mismatched environment gate %s=%s", async (key, value) => {
    const { token, options } = fixture();
    await expect(claimStagingAiAcceptance(token, {
      ...options, env: { ...env, [key]: value },
    })).rejects.toMatchObject({ code: "STAGING_AI_ACCEPTANCE_REJECTED" });
  });

  it.each([
    { origin: undefined }, { origin: `${env.CLIENT_URL}/` },
    { actorId: undefined }, { actorId: new mongoose.Types.ObjectId().toString() },
    { connection: { readyState: 0, db: { databaseName: "htcoaching_staging" } } },
    { connection: { readyState: 1, db: { databaseName: "htcoaching" } } },
  ])("rejects invalid actor/origin/connected DB binding %#", async (change) => {
    const { token, options } = fixture();
    await expect(claimStagingAiAcceptance(token, { ...options, ...change }))
      .rejects.toMatchObject({ status: 403 });
  });

  it.each([
    { message: "Different text" }, { requestId: randomUUID() },
    { conversationId: new mongoose.Types.ObjectId().toString() },
    { context: { page: "/different" } },
    { context: { image: "data:image/png;base64,aGVsbG8=" } },
  ])("rejects modified parsed payload binding %#", async (change) => {
    const { token, options } = fixture();
    await expect(claimStagingAiAcceptance(token, {
      ...options, request: { ...options.request, ...change },
    })).rejects.toMatchObject({ status: 403 });
  });

  it("canonicalizes equivalent parsed context without depending on object key order", () => {
    const { token, options } = fixture({ request: {
      message: " Xin chào ", requestId: randomUUID(),
      context: { page: "/", userMetrics: { weightKg: 60, heightCm: 170 } },
    } });
    expect(verifyStagingAiAcceptance(token, { ...options, request: {
      ...options.request, message: "Xin chào",
      context: { userMetrics: { heightCm: 170, weightKg: 60 }, page: "/" },
    } }).mode).toBe("paced_response");
  });

  it.each([
    { exp: 1 }, { exp: "too-long" },
    { iat: Math.floor(Date.now() / 1000) + 10 }, { aud: "wrong" },
    { iss: "wrong" }, { mode: "arbitrary_response" }, { unexpected: true },
  ])("rejects invalid signed claim %#", (change) => {
    const { token, options } = fixture();
    const key = createHmac("sha256", env.JWT_SECRET)
      .update("htcoaching:staging-ai-acceptance:hs256:v1").digest();
    const claims = jwt.decode(token);
    const changed = { ...claims, ...change };
    if (change.exp === "too-long") changed.exp = claims.iat + 301;
    const tampered = jwt.sign(changed, key, { algorithm: "HS256" });
    expect(() => verifyStagingAiAcceptance(tampered, options)).toThrow("Staging AI acceptance rejected");
  });

  it("allows only a bounded five-second issuer clock lead", () => {
    const { token, options } = fixture();
    const key = createHmac("sha256", env.JWT_SECRET)
      .update("htcoaching:staging-ai-acceptance:hs256:v1").digest();
    const claims = jwt.decode(token);
    const iat = Math.floor(Date.now() / 1000) + 4;
    const clockSkewed = jwt.sign({ ...claims, iat, exp: iat + 300 }, key, {
      algorithm: "HS256",
    });
    expect(verifyStagingAiAcceptance(clockSkewed, options).iat).toBe(iat);
  });

  it.each(["HS384", "none"])("rejects algorithm %s", (algorithm) => {
    const { token, options } = fixture();
    const key = createHmac("sha256", env.JWT_SECRET)
      .update("htcoaching:staging-ai-acceptance:hs256:v1").digest();
    const altered = jwt.sign(jwt.decode(token), algorithm === "none" ? null : key, { algorithm });
    expect(() => verifyStagingAiAcceptance(altered, options)).toThrow("Staging AI acceptance rejected");
  });

  it("does not accept a capability signed directly with the auth JWT secret", () => {
    const { token, options } = fixture();
    const authSigned = jwt.sign(jwt.decode(token), env.JWT_SECRET);
    expect(() => verifyStagingAiAcceptance(authSigned, options)).toThrow("Staging AI acceptance rejected");
  });

  it("rejects JWT header extensions and never leaks verification details", () => {
    const { token, options } = fixture();
    const key = createHmac("sha256", env.JWT_SECRET)
      .update("htcoaching:staging-ai-acceptance:hs256:v1").digest();
    const altered = jwt.sign(jwt.decode(token), key, { header: { kid: "untrusted-key" } });
    expect(() => verifyStagingAiAcceptance(altered, options)).toThrow("Staging AI acceptance rejected");
  });

  it("fails closed when the claim store cannot acknowledge the atomic insert", async () => {
    const { token, options } = fixture();
    const unavailable = { readyState: 1, db: { databaseName: "htcoaching_staging",
      collection: () => ({ findOne: async () => ({ _id: actorId }),
        insertOne: async () => { throw new Error("private connection details"); } }),
    } };
    await expect(claimStagingAiAcceptance(token, { ...options, connection: unavailable }))
      .rejects.toMatchObject({ message: "Staging AI acceptance rejected", code: "STAGING_AI_ACCEPTANCE_REJECTED" });
  });

  it.each([{ role: "admin" }, { email: "ordinary@example.invalid" }])("rejects a non-synthetic actor %#", async (change) => {
    const { token, options } = fixture();
    await connection.db.collection("users").updateOne({ _id: new mongoose.Types.ObjectId(actorId) }, { $set: change });
    await expect(claimStagingAiAcceptance(token, options)).rejects.toMatchObject({ status: 403 });
    expect(await connection.db.collection(STAGING_AI_ACCEPTANCE_COLLECTION).countDocuments()).toBe(0);
  });

  it("does not accept a different HTTPS client origin even if Origin matches configuration", () => {
    const { token, options } = fixture();
    expect(() => verifyStagingAiAcceptance(token, { ...options, origin: "https://wrong.example",
      env: { ...env, CLIENT_URL: "https://wrong.example" },
    })).toThrow("Staging AI acceptance rejected");
  });

  it("keeps first-frame barrier closed until an exact record release", async () => {
    const { token, options } = fixture();
    const accepted = await claimStagingAiAcceptance(token, options);
    const collection = connection.db.collection(STAGING_AI_ACCEPTANCE_COLLECTION);
    let completed = false;
    const barrier = waitForStagingAiAcceptanceRelease(accepted, { connection }).then(() => { completed = true; });
    await vi.waitFor(async () => expect((await collection.findOne({ _id: accepted.jti })).status).toBe("first_frame"));
    expect(completed).toBe(false);
    await collection.updateOne({ _id: accepted.jti, status: "first_frame" }, { $set: { status: "released" } });
    await barrier;
    expect(completed).toBe(true);
  });

  it("acknowledges abort without releasing the late response", async () => {
    const { token, options } = fixture();
    const accepted = await claimStagingAiAcceptance(token, options);
    const controller = new AbortController();
    const collection = connection.db.collection(STAGING_AI_ACCEPTANCE_COLLECTION);
    const barrier = waitForStagingAiAcceptanceRelease(accepted, { connection, signal: controller.signal });
    await vi.waitFor(async () => expect((await collection.findOne({ _id: accepted.jti })).status).toBe("first_frame"));
    controller.abort();
    await barrier;
    expect((await collection.findOne({ _id: accepted.jti })).status).toBe("aborted");
  });

  it("fails closed at the ten-second barrier deadline with no automatic release", async () => {
    const { token, options } = fixture();
    const accepted = await claimStagingAiAcceptance(token, options);
    await expect(waitForStagingAiAcceptanceRelease(accepted, { connection }))
      .rejects.toMatchObject({ code: "STAGING_AI_ACCEPTANCE_BARRIER_FAILED" });
    expect((await connection.db.collection(STAGING_AI_ACCEPTANCE_COLLECTION).findOne({ _id: accepted.jti })).status).toBe("timed_out");
  });

  it("rejects replays atomically across separate database connections", async () => {
    const { token, options } = fixture();
    const peer = await mongoose.createConnection(mongo.getUri(), { dbName: "htcoaching_staging" }).asPromise();
    try {
      const results = await Promise.allSettled([
        claimStagingAiAcceptance(token, options),
        claimStagingAiAcceptance(token, { ...options, connection: peer }),
      ]);
      expect(results.map((result) => result.status).sort()).toEqual(["fulfilled", "rejected"]);
    } finally {
      await peer.close();
    }
  });

  it("claims a signed request once and stores only sanitized metadata", async () => {
    const { token, options, claims } = fixture();
    const accepted = await claimStagingAiAcceptance(token, options);
    const record = await connection.db.collection(STAGING_AI_ACCEPTANCE_COLLECTION).findOne({ _id: accepted.jti });
    expect(record).toEqual({
      _id: accepted.jti, runId: claims.runId, actorId: claims.actorId,
      requestId: claims.request.requestId, conversationId: null, releaseSha: env.RENDER_GIT_COMMIT,
      mode: "paced_response", payloadDigest: expect.stringMatching(/^[0-9a-f]{64}$/),
      createdAt: expect.any(Date), expiresAt: expect.any(Date), status: "claimed",
    });
  });
});
