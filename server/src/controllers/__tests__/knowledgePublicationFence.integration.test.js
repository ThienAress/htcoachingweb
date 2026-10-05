import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import request from "supertest";
import {
  clearCollections, createTestApp, createTestUser, setupTestDB,
  teardownTestDB, withAuth,
} from "../../__tests__/setup.js";
import KnowledgeEntry from "../../models/KnowledgeEntry.js";
import knowledgeBaseRoutes from "../../routes/knowledgeBase.routes.js";
import { EMBEDDING_DIMENSION, EMBEDDING_VERSION } from "../../services/ai/embeddingProfile.js";
import { knowledgePublicationProjection, knowledgePublicationTag } from "../../services/knowledgePublicationFence.js";

let app;
beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/knowledge-base", knowledgeBaseRoutes);
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await clearCollections();
});
afterAll(teardownTestDB);

const makeDraft = (adminId) => KnowledgeEntry.create({
  question: "Synthetic publication fence question?",
  answer: "Synthetic approved answer.",
  category: "service",
  status: "draft",
  evidenceLevel: "canonical_internal",
  sources: [{ type: "internal", title: "Synthetic canonical source", publisher: "HT Coaching", evidenceTier: "canonical" }],
  embedding: Array.from({ length: EMBEDDING_DIMENSION }, (_, index) => index / EMBEDDING_DIMENSION),
  embeddingStatus: "ready",
  embeddingVersion: EMBEDDING_VERSION,
  createdBy: adminId,
});
const rawDraft = (id) => KnowledgeEntry.collection.findOne(
  { _id: id }, { projection: knowledgePublicationProjection, promoteValues: false },
);
const publish = (id, accessToken, tag, body = { status: "published" }) =>
  withAuth(request(app).put(`/api/knowledge-base/${id}`).set("If-Match", tag).send(body), accessToken);

describe("conditional Admin Knowledge Base publication", () => {
  it("publishes the exact draft and assigns the authenticated server reviewer", async () => {
    const { user, accessToken } = await createTestUser({ role: "admin" });
    const draft = await makeDraft(user._id);
    const tag = knowledgePublicationTag(await rawDraft(draft._id));
    const response = await publish(draft._id, accessToken, tag);
    const stored = await KnowledgeEntry.findById(draft._id);
    expect({ status: response.status, code: response.body.code, storedStatus: stored.status, reviewer: String(stored.reviewedBy) })
      .toEqual({ status: 200, code: undefined, storedStatus: "published", reviewer: String(user._id) });
  });

  it("rejects stale raw drift without an incremented version before provider use", async () => {
    const { user, accessToken } = await createTestUser({ role: "admin" });
    const draft = await makeDraft(user._id);
    const tag = knowledgePublicationTag(await rawDraft(draft._id));
    await KnowledgeEntry.collection.updateOne({ _id: draft._id }, { $set: { answer: "Changed by raw writer" } });
    const provider = vi.fn();
    vi.stubGlobal("fetch", provider);
    const response = await publish(draft._id, accessToken, tag);
    expect({ status: response.status, code: response.body.code, calls: provider.mock.calls.length })
      .toEqual({ status: 412, code: "KNOWLEDGE_PUBLICATION_PRECONDITION_FAILED", calls: 0 });
  });

  it("rejects raw answer drift after the snapshot read with unchanged __v", async () => {
    const { user, accessToken } = await createTestUser({ role: "admin" });
    const draft = await makeDraft(user._id);
    const tag = knowledgePublicationTag(await rawDraft(draft._id));
    const read = KnowledgeEntry.collection.findOne.bind(KnowledgeEntry.collection);
    vi.spyOn(KnowledgeEntry.collection, "findOne").mockImplementation(async (...args) => {
      const snapshot = await read(...args);
      await KnowledgeEntry.collection.updateOne({ _id: draft._id }, { $set: { answer: "Late raw change" } });
      return snapshot;
    });
    const response = await publish(draft._id, accessToken, tag);
    const stored = await read({ _id: draft._id });
    expect({ status: response.status, code: response.body.code, answer: stored.answer, version: stored.__v })
      .toEqual({ status: 412, code: "KNOWLEDGE_PUBLICATION_PRECONDITION_FAILED", answer: "Late raw change", version: draft.__v });
  });

  it("rejects a nested numeric BSON type drift after read", async () => {
    const { user, accessToken } = await createTestUser({ role: "admin" });
    const draft = await makeDraft(user._id);
    const tag = knowledgePublicationTag(await rawDraft(draft._id));
    const read = KnowledgeEntry.collection.findOne.bind(KnowledgeEntry.collection);
    vi.spyOn(KnowledgeEntry.collection, "findOne").mockImplementation(async (...args) => {
      const snapshot = await read(...args);
      const vector = [...snapshot.embedding];
      vector[0] = snapshot.embedding[0]?._bsontype === "Int32"
        ? new mongoose.mongo.BSON.Double(0)
        : new mongoose.mongo.BSON.Int32(0);
      await KnowledgeEntry.collection.updateOne({ _id: draft._id }, { $set: { embedding: vector } });
      return snapshot;
    });
    const response = await publish(draft._id, accessToken, tag);
    expect(response.status).toBe(412);
  });

  it.each([
    ["missing to null", { $set: { reviewedAt: null } }],
    ["null to missing", { $unset: { embeddingError: "" } }],
    ["scalar to array", { $set: { answer: ["Synthetic approved answer."] } }],
  ])("rejects %s drift", async (_name, update) => {
    const { user, accessToken } = await createTestUser({ role: "admin" });
    const draft = await makeDraft(user._id);
    if (_name === "missing to null") await KnowledgeEntry.collection.updateOne({ _id: draft._id }, { $unset: { reviewedAt: "" } });
    const tag = knowledgePublicationTag(await rawDraft(draft._id));
    await KnowledgeEntry.collection.updateOne({ _id: draft._id }, update);
    const response = await publish(draft._id, accessToken, tag);
    expect(response.status).toBe(412);
  });

  it("rejects malformed tag and extra raw body fields", async () => {
    const { user, accessToken } = await createTestUser({ role: "admin" });
    const draft = await makeDraft(user._id);
    const tag = knowledgePublicationTag(await rawDraft(draft._id));
    const [weak, extra] = await Promise.all([
      publish(draft._id, accessToken, `W/${tag}`),
      publish(draft._id, accessToken, tag, { status: "published", skipDuplicateCheck: true }),
    ]);
    expect([weak.status, extra.status]).toEqual([400, 400]);
  });

  it("preserves role and CSRF gates", async () => {
    const admin = await createTestUser({ role: "admin" });
    const other = await createTestUser({ role: "user" });
    const draft = await makeDraft(admin.user._id);
    const tag = knowledgePublicationTag(await rawDraft(draft._id));
    const [wrongRole, noCsrf] = await Promise.all([
      publish(draft._id, other.accessToken, tag),
      request(app).put(`/api/knowledge-base/${draft._id}`).set("If-Match", tag)
        .set("Cookie", `accessToken=${admin.accessToken}`).send({ status: "published" }),
    ]);
    expect([wrongRole.status, noCsrf.status]).toEqual([403, 403]);
  });

  it("permits one concurrent publisher and rejects replay", async () => {
    const { user, accessToken } = await createTestUser({ role: "admin" });
    const draft = await makeDraft(user._id);
    const tag = knowledgePublicationTag(await rawDraft(draft._id));
    const read = KnowledgeEntry.collection.findOne.bind(KnowledgeEntry.collection);
    let reads = 0;
    let release;
    const bothRead = new Promise((resolve) => { release = resolve; });
    vi.spyOn(KnowledgeEntry.collection, "findOne").mockImplementation(async (...args) => {
      const snapshot = await read(...args);
      reads += 1;
      if (reads === 2) release();
      await bothRead;
      return snapshot;
    });
    const results = await Promise.all([publish(draft._id, accessToken, tag), publish(draft._id, accessToken, tag)]);
    vi.restoreAllMocks();
    const replay = await publish(draft._id, accessToken, tag);
    expect({ reads, outcomes: results.map((result) => result.status).sort(), replay: replay.status })
      .toEqual({ reads: 2, outcomes: [200, 412], replay: 412 });
  });

  it("keeps the ordinary no-header update contract", async () => {
    const { user, accessToken } = await createTestUser({ role: "admin" });
    const draft = await makeDraft(user._id);
    const response = await withAuth(request(app).put(`/api/knowledge-base/${draft._id}`).send({ status: "published" }), accessToken);
    expect(response.status).toBe(200);
  });

  it("preserves usage counters and last-used metadata outside the publication projection", async () => {
    const { user, accessToken } = await createTestUser({ role: "admin" });
    const draft = await makeDraft(user._id);
    const lastUsedAt = new Date("2026-10-01T00:00:00Z");
    await KnowledgeEntry.collection.updateOne({ _id: draft._id }, { $set: { usageCount: 41, lastUsedAt } });
    const response = await publish(draft._id, accessToken, knowledgePublicationTag(await rawDraft(draft._id)));
    const stored = await KnowledgeEntry.collection.findOne({ _id: draft._id });
    expect({ status: response.status, usageCount: stored.usageCount, lastUsedAt: stored.lastUsedAt })
      .toEqual({ status: 200, usageCount: 41, lastUsedAt });
  });

  it("preserves a raw usage increment made after the approved snapshot read", async () => {
    const { user, accessToken } = await createTestUser({ role: "admin" });
    const draft = await makeDraft(user._id);
    await KnowledgeEntry.collection.updateOne({ _id: draft._id }, { $set: { usageCount: 41 } });
    const tag = knowledgePublicationTag(await rawDraft(draft._id));
    const read = KnowledgeEntry.collection.findOne.bind(KnowledgeEntry.collection);
    vi.spyOn(KnowledgeEntry.collection, "findOne").mockImplementationOnce(async (...args) => {
      const snapshot = await read(...args);
      await KnowledgeEntry.collection.updateOne({ _id: draft._id }, { $inc: { usageCount: 1 } });
      return snapshot;
    });
    const response = await publish(draft._id, accessToken, tag);
    const stored = await read({ _id: draft._id });
    expect({ status: response.status, usageCount: stored.usageCount }).toEqual({ status: 200, usageCount: 42 });
  });
});
