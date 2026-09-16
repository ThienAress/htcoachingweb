import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertFixtureCreateSettled, createTrackedKnowledgeFixture, fixtureCreateJournalId,
} from "../stagingAiChatAcceptance.fixture.js";

let memory;
let collection;
const options = () => {
  const runId = randomUUID();
  return { collection, runId, marker: `htcoaching-acceptance:${runId}`, releaseSha: "a".repeat(40),
    actorId: String(new mongoose.Types.ObjectId()), sourceUrl: "https://www.who.int/news-room/fact-sheets/detail/physical-activity" };
};
const validResponse = () => ({ data: {
  _id: String(new mongoose.Types.ObjectId()), status: "published", reviewStatus: "reviewed",
  embeddingStatus: "ready", embeddingVersion: "locked-target",
} });

beforeAll(async () => {
  memory = await MongoMemoryServer.create();
  await mongoose.connect(memory.getUri("htcoaching_staging"));
  collection = mongoose.connection.db.collection("staging_ai_acceptance_claims");
});
beforeEach(async () => { await collection.deleteMany({}); });
afterAll(async () => { await mongoose.disconnect(); await memory.stop(); });

describe("AC-009 durable fixture-create journal", () => {
  it("persists pending before POST and settles only after a validated 201", async () => {
    const config = options();
    const response = validResponse();
    const api = { request: vi.fn(async () => {
      expect(await collection.findOne({ _id: fixtureCreateJournalId(config.runId) }))
        .toMatchObject({ state: "pending", knowledgeEntryId: null });
      return response;
    }) };
    await createTrackedKnowledgeFixture({ ...config, api });
    expect(await assertFixtureCreateSettled(config)).toMatchObject({
      journalVersion: 2, state: "terminal", outcome: "created",
      actorId: config.actorId, knowledgeEntryId: response.data._id, responseStatus: 201,
    });
  });

  it.each(["timeout", "malformed 201"])("keeps pending after %s rather than certifying a terminal POST", async (kind) => {
    const config = options();
    const api = { request: vi.fn(async () => {
      if (kind === "timeout") throw new Error("synthetic response lost");
      return {};
    }) };
    await expect(createTrackedKnowledgeFixture({ ...config, api })).rejects.toBeInstanceOf(Error);
    expect(await collection.findOne({ _id: fixtureCreateJournalId(config.runId) }))
      .toMatchObject({ state: "pending", settledAt: null, knowledgeEntryId: null });
  });

  it("persists a terminal rejection only for an exact known pre-write response", async () => {
    const config = options();
    let error;
    await expect(createTrackedKnowledgeFixture({
      ...config,
      api: { request: vi.fn(async (_path, request) => {
        error = Object.assign(new Error("synthetic privacy rejection"), {
          remoteOutcomeKnown: true,
          httpStatus: 400,
          responseCode: "KNOWLEDGE_QUERY_SENSITIVE",
          requestId: request.headers["X-Request-Id"],
        });
        throw error;
      }) },
    })).rejects.toMatchObject({ remoteOutcomeKnown: true });
    expect(await collection.findOne({ _id: fixtureCreateJournalId(config.runId) })).toMatchObject({
      journalVersion: 2,
      state: "terminal",
      outcome: "rejected",
      knowledgeEntryId: null,
      responseStatus: 400,
      responseCode: "KNOWLEDGE_QUERY_SENSITIVE",
      requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      payloadDigest: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  });

  it("does not send POST when journal insertion is unacknowledged", async () => {
    const config = options();
    const api = { request: vi.fn() };
    await expect(createTrackedKnowledgeFixture({ ...config, api,
      collection: { findOne: async () => null, insertOne: async () => ({ acknowledged: false }) },
    })).rejects.toMatchObject({ code: "STAGING_AI_RECOVERY_FIXTURE_UNKNOWN" });
    expect(api.request).not.toHaveBeenCalled();
  });

  it("keeps pending when the settlement CAS is not acknowledged", async () => {
    const config = options();
    const faultCollection = new Proxy(collection, {
      get: (target, property) => property === "updateOne" ? async () => ({ acknowledged: false, modifiedCount: 0 })
        : typeof target[property] === "function" ? target[property].bind(target) : target[property],
    });
    await expect(createTrackedKnowledgeFixture({ ...config, collection: faultCollection,
      api: { request: vi.fn().mockResolvedValue(validResponse()) },
    })).rejects.toMatchObject({ code: "STAGING_AI_RECOVERY_FIXTURE_UNKNOWN" });
    expect(await collection.findOne({ _id: fixtureCreateJournalId(config.runId) })).toMatchObject({ state: "pending" });
  });

  it("does not send POST when recovery revokes during preregistration", async () => {
    const config = options();
    const api = { request: vi.fn() };
    const raceCollection = new Proxy(collection, {
      get: (target, property) => property === "insertOne" ? async (...args) => {
        const result = await target.insertOne(...args);
        await target.insertOne({ _id: config.runId, recordType: "run", runId: config.runId, state: "revoked" });
        return result;
      } : typeof target[property] === "function" ? target[property].bind(target) : target[property],
    });
    await expect(createTrackedKnowledgeFixture({ ...config, collection: raceCollection, api }))
      .rejects.toMatchObject({ code: "STAGING_AI_RECOVERY_FIXTURE_UNKNOWN" });
    expect(api.request).not.toHaveBeenCalled();
  });

  it.each(["releaseSha", "actorId", "questionDigest", "extra"])("refuses malformed or cross-binding settled proof: %s", async (field) => {
    const config = options();
    await createTrackedKnowledgeFixture({ ...config, api: { request: vi.fn().mockResolvedValue(validResponse()) } });
    const value = field === "releaseSha" ? "b".repeat(40) : field === "actorId" ? "invalid" : "invalid";
    await collection.updateOne({ _id: fixtureCreateJournalId(config.runId) }, { $set: { [field]: value } });
    await expect(assertFixtureCreateSettled(config))
      .rejects.toMatchObject({ code: "STAGING_AI_RECOVERY_FIXTURE_UNKNOWN" });
  });
});
