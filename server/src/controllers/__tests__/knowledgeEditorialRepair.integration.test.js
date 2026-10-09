import { createHash } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import request from "supertest";
import {
  clearCollections, createTestApp, createTestUser, setupTestDB, teardownTestDB, withAuth,
} from "../../__tests__/setup.js";
import KnowledgeEntry from "../../models/KnowledgeEntry.js";
import knowledgeBaseRoutes from "../../routes/knowledgeBase.routes.js";
import { generateEmbedding } from "../../services/ai/embedding.service.js";
import { EMBEDDING_DIMENSION, EMBEDDING_VERSION } from "../../services/ai/embeddingProfile.js";
import { knowledgePublicationTag } from "../../services/knowledgePublicationFence.js";

vi.mock("../../services/ai/embedding.service.js", async (importOriginal) => ({
  ...await importOriginal(), generateEmbedding: vi.fn(),
}));

let app;
const vector = (value = 0.25) => Array.from({ length: EMBEDDING_DIMENSION }, (_, index) => index ? value : 0);
const rawEntry = (id) => KnowledgeEntry.collection.findOne({ _id: id }, { promoteValues: false });
const serialized = (raw) => mongoose.mongo.BSON.EJSON.stringify(raw, { relaxed: false });
// Independent reproduction of the private approval builder's persisted-content contract.
const contentHash = (raw) => createHash("sha256").update(JSON.stringify({
  question: raw.question, answer: raw.answer, variants: raw.variants.map(({ text }) => text),
  tags: raw.tags, sources: raw.sources,
})).digest("hex");
const endpoint = (id, operation = "editorial-repair") => `/api/knowledge-base/${id}/${operation}`;
const metadataOnly = (data) => !Object.keys(data || {}).some((key) =>
  ["question", "answer", "tags", "variants", "sources", "embedding", "reviewedBy", "createdBy", "source"].includes(key));
const fixture = async () => {
  const admin = await createTestUser({ role: "admin" });
  const draft = await KnowledgeEntry.create({
    question: "Synthetic publication question?", answer: "Synthetic canonical answer.",
    category: "service", status: "draft", evidenceLevel: "canonical_internal",
    sources: [{ type: "internal", title: "Synthetic source", publisher: "HT Coaching",
      evidenceTier: "canonical", retrievedAt: new Date("2026-10-01T00:00:00Z") }],
    tags: ["synthetic"], variants: [{ text: "Synthetic alternate question?", embedding: vector(0.1) }],
    embedding: vector(), embeddingStatus: "ready", embeddingVersion: EMBEDDING_VERSION,
    reviewStatus: "reviewed", reviewedBy: admin.user._id, reviewedAt: new Date(), createdBy: admin.user._id,
  });
  const raw = await rawEntry(draft._id);
  return { ...admin, id: draft._id, raw, tag: knowledgePublicationTag(raw),
    precondition: { expectedHash: contentHash(raw), expectedRevision: Number(raw.revision) } };
};
const repair = (f, patch = { answer: "Synthetic repaired answer." }, options = {}) => {
  const req = request(app).put(endpoint(f.id));
  if (options.tag !== null) req.set("If-Match", options.tag ?? f.tag);
  return withAuth(req.send(options.body ?? { ...f.precondition, patch }), f.accessToken);
};
beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/knowledge-base", knowledgeBaseRoutes);
});
beforeEach(() => vi.mocked(generateEmbedding).mockReset().mockResolvedValue(vector(0.75)));
afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllGlobals(); await clearCollections(); });
afterAll(teardownTestDB);

describe("atomic Admin Knowledge Base editorial repair", () => {
  it("returns metadata with the raw content hash and full publication fence", async () => {
    const f = await fixture();
    const response = await withAuth(request(app).get(endpoint(f.id, "editorial-state")), f.accessToken);
    expect({ status: response.status, success: response.body.success, data: response.body.data,
      privateFieldsAbsent: metadataOnly(response.body.data), calls: generateEmbedding.mock.calls.length }).toEqual({
      status: 200, success: true, data: expect.objectContaining({ entryId: String(f.id),
        contentHash: f.precondition.expectedHash, revision: 1, status: "draft", reviewStatus: "reviewed",
        embeddingStatus: "ready", embeddingVersion: EMBEDDING_VERSION, publicationTag: f.tag }),
      privateFieldsAbsent: true, calls: 0,
    });
    expect(response.headers["cache-control"]).toContain("no-store");
  });

  it("preserves authentication, admin role and CSRF gates", async () => {
    const f = await fixture();
    const other = await createTestUser({ role: "user" });
    const results = await Promise.all([
      request(app).get(endpoint(f.id, "editorial-state")),
      withAuth(request(app).get(endpoint(f.id, "editorial-state")), other.accessToken),
      repair({ ...f, accessToken: other.accessToken }),
      request(app).put(endpoint(f.id)).set("If-Match", f.tag)
        .set("Cookie", `accessToken=${f.accessToken}`).send({ ...f.precondition, patch: { answer: "Changed" } }),
    ]);
    expect({ statuses: results.map(({ status }) => status), calls: generateEmbedding.mock.calls.length,
      unchanged: serialized(await rawEntry(f.id)) === serialized(f.raw) })
      .toEqual({ statuses: [401, 403, 403, 403], calls: 0, unchanged: true });
  });

  it.each(["hash", "revision", "tag", "draft", "raw drift"])("rejects stale %s before embedding", async (kind) => {
    const f = await fixture();
    if (kind === "hash") f.precondition.expectedHash = "0".repeat(64);
    if (kind === "revision") f.precondition.expectedRevision += 1;
    if (kind === "tag") f.tag = `"kb-publish-v1-${"0".repeat(64)}"`;
    if (kind === "draft" || kind === "raw drift") await KnowledgeEntry.collection.updateOne({ _id: f.id },
      { $set: kind === "draft" ? { status: "archived" } : { category: "platform" } });
    const before = await rawEntry(f.id);
    const response = await repair(f, { question: "Synthetic replacement question?" });
    expect({ status: response.status, code: response.body.code, calls: generateEmbedding.mock.calls.length,
      unchanged: serialized(await rawEntry(f.id)) === serialized(before) }).toEqual({
      status: 412, code: "KNOWLEDGE_EDITORIAL_PRECONDITION_FAILED", calls: 0, unchanged: true,
    });
  });

  it.each([
    ["missing tag", (f) => ({ tag: null })],
    ["weak tag", (f) => ({ tag: `W/${f.tag}` })],
    ["missing hash", (f) => ({ body: { expectedRevision: 1, patch: { answer: "Changed" } } })],
    ["string revision", (f) => ({ body: { ...f.precondition, expectedRevision: "1", patch: { answer: "Changed" } } })],
    ["extra envelope", (f) => ({ body: { ...f.precondition, patch: { answer: "Changed" }, skipDuplicateCheck: true } })],
    ...["status", "reviewedBy", "reviewStatus", "evidenceLevel", "embedding", "revision"].map((key) =>
      [key, (f) => ({ body: { ...f.precondition, patch: { answer: "Changed", [key]: "injected" } } })]),
    ["object variants", (f) => ({ body: { ...f.precondition, patch: { variants: [{ text: "Synthetic variant?" }] } } })],
    ["invalid sources", (f) => ({ body: { ...f.precondition, patch: { sources: ["invalid"] } } })],
  ])("rejects invalid/mass-assignment input: %s", async (_name, options) => {
    const f = await fixture();
    const response = await repair(f, undefined, options(f));
    expect({ status: response.status, code: response.body.code, calls: generateEmbedding.mock.calls.length,
      unchanged: serialized(await rawEntry(f.id)) === serialized(f.raw) }).toEqual({
      status: 400, code: "KNOWLEDGE_EDITORIAL_PRECONDITION_INVALID", calls: 0, unchanged: true,
    });
  });

  it.each(["question", "answer", "tags", "variants", "sources"])("rejects private %s before embedding", async (field) => {
    const f = await fixture();
    const privateText = "Client zoraqx quux has lupus.";
    const value = ["tags", "variants"].includes(field) ? [privateText] : field === "sources"
      ? [{ type: "internal", title: privateText, publisher: "HT Coaching", evidenceTier: "canonical" }] : privateText;
    const response = await repair(f, { [field]: value });
    expect({ status: response.status, code: response.body.code, calls: generateEmbedding.mock.calls.length,
      unchanged: serialized(await rawEntry(f.id)) === serialized(f.raw) }).toEqual({
      status: 400, code: "KNOWLEDGE_QUERY_SENSITIVE", calls: 0, unchanged: true,
    });
  });

  it.each(["provider failure", "later variant failure", "invalid dimension", "non-finite vector"])
    ("leaves raw document untouched after %s", async (failure) => {
      const f = await fixture();
      if (failure === "provider failure") vi.mocked(generateEmbedding).mockRejectedValueOnce(new Error("Synthetic outage"));
      if (failure === "later variant failure") vi.mocked(generateEmbedding).mockResolvedValueOnce(vector())
        .mockRejectedValueOnce(new Error("Synthetic variant outage"));
      if (failure === "invalid dimension") vi.mocked(generateEmbedding).mockResolvedValue([1]);
      if (failure === "non-finite vector") vi.mocked(generateEmbedding).mockResolvedValue(vector(NaN));
      const writes = vi.spyOn(KnowledgeEntry.collection, "updateOne");
      const response = await repair(f, { question: "Synthetic replacement question?" });
      expect({ status: response.status, code: response.body.code, writes: writes.mock.calls.length,
        unchanged: serialized(await rawEntry(f.id)) === serialized(f.raw) }).toEqual({
        status: 503, code: "KNOWLEDGE_EDITORIAL_EMBEDDING_FAILED", writes: 0, unchanged: true,
      });
    });

  it("saves all material changes once with fresh vectors and permits conditional publication", async () => {
    const f = await fixture();
    const patch = { question: "Synthetic repaired question?", answer: "Synthetic repaired answer.",
      category: "platform", tags: ["repaired"], variants: ["Synthetic repaired variant?"],
      sources: [{ type: "internal", title: "Synthetic replacement source", publisher: "HT Coaching", evidenceTier: "canonical" }] };
    vi.mocked(generateEmbedding).mockResolvedValueOnce(vector(0.5)).mockResolvedValueOnce(vector(0.75));
    const writes = vi.spyOn(KnowledgeEntry.collection, "updateOne");
    const response = await repair(f, patch);
    const stored = await KnowledgeEntry.findById(f.id).select("+embedding +variants").lean();
    expect({ status: response.status, writes: writes.mock.calls.length, privateFieldsAbsent: metadataOnly(response.body.data),
      entry: { question: stored.question, answer: stored.answer, category: stored.category, tags: stored.tags,
        sourceTitle: stored.sources[0].title, variant: stored.variants[0].text, variantVector: stored.variants[0].embedding,
        embedding: stored.embedding, embeddingStatus: stored.embeddingStatus, embeddingVersion: stored.embeddingVersion,
        status: stored.status, revision: stored.revision, reviewStatus: stored.reviewStatus,
        reviewedBy: stored.reviewedBy, reviewedAt: stored.reviewedAt } }).toEqual({
      status: 200, writes: 1, privateFieldsAbsent: true, entry: { question: patch.question, answer: patch.answer,
        category: patch.category, tags: patch.tags, sourceTitle: patch.sources[0].title, variant: patch.variants[0],
        variantVector: vector(0.75), embedding: vector(0.5), embeddingStatus: "ready", embeddingVersion: EMBEDDING_VERSION,
        status: "draft", revision: 2, reviewStatus: "needs_review", reviewedBy: null, reviewedAt: null },
    });
    const raw = await rawEntry(f.id);
    expect(response.body.data).toMatchObject({ contentHash: contentHash(raw), revision: 2,
      publicationTag: knowledgePublicationTag(raw) });
    const published = await withAuth(request(app).put(`/api/knowledge-base/${f.id}`)
      .set("If-Match", response.body.data.publicationTag).send({ status: "published" }), f.accessToken);
    const final = await KnowledgeEntry.findById(f.id);
    expect({ status: published.status, entryStatus: final.status, reviewer: String(final.reviewedBy) })
      .toEqual({ status: 200, entryStatus: "published", reviewer: String(f.user._id) });
  });

  it("preserves existing vectors for answer-only edits and rejects replay of the approved original", async () => {
    const f = await fixture();
    const response = await repair(f);
    const stored = await rawEntry(f.id);
    const replay = await repair(f);
    expect({ status: response.status, replay: replay.status, replayCode: replay.body.code,
      calls: generateEmbedding.mock.calls.length, revision: Number(stored.revision),
      vectors: serialized({ embedding: stored.embedding, variants: stored.variants }),
      version: Number(stored.__v) }).toEqual({ status: 200, replay: 412,
      replayCode: "KNOWLEDGE_EDITORIAL_PRECONDITION_FAILED", calls: 0, revision: 2,
      vectors: serialized({ embedding: f.raw.embedding, variants: f.raw.variants }), version: Number(f.raw.__v) + 1 });
  });

  it.each(["raw answer", "numeric BSON", "Mongoose edit"])("rejects concurrent %s during embedding", async (kind) => {
    const f = await fixture();
    let concurrent;
    vi.mocked(generateEmbedding).mockImplementationOnce(async () => {
      if (kind === "Mongoose edit") {
        const other = await KnowledgeEntry.findById(f.id);
        other.answer = "Synthetic concurrent answer.";
        await other.save();
      } else if (kind === "numeric BSON") {
        const embedding = [...f.raw.embedding];
        embedding[0] = embedding[0]?._bsontype === "Int32"
          ? new mongoose.mongo.BSON.Double(0) : new mongoose.mongo.BSON.Int32(0);
        await KnowledgeEntry.collection.updateOne({ _id: f.id }, { $set: { embedding } });
      } else await KnowledgeEntry.collection.updateOne({ _id: f.id }, { $set: { answer: "Synthetic concurrent answer." } });
      concurrent = await rawEntry(f.id);
      return vector(0.75);
    });
    const response = await repair(f, { question: "Synthetic replacement question?" });
    expect({ status: response.status, code: response.body.code,
      onlyConcurrentWrite: serialized(await rawEntry(f.id)) === serialized(concurrent) }).toEqual({
      status: 412, code: "KNOWLEDGE_EDITORIAL_PRECONDITION_FAILED", onlyConcurrentWrite: true,
    });
  });

  it("preserves usage increments outside the editorial fence while generating embeddings", async () => {
    const f = await fixture();
    const lastUsedAt = new Date("2026-10-08T00:00:00Z");
    vi.mocked(generateEmbedding).mockImplementationOnce(async () => {
      await KnowledgeEntry.collection.updateOne({ _id: f.id }, { $inc: { usageCount: 1 }, $set: { lastUsedAt } });
      return vector(0.75);
    });
    const response = await repair(f, { question: "Synthetic replacement question?" });
    const stored = await rawEntry(f.id);
    expect({ status: response.status, usageCount: Number(stored.usageCount), lastUsedAt: stored.lastUsedAt,
      revision: Number(stored.revision) }).toEqual({ status: 200, usageCount: 1, lastUsedAt, revision: 2 });
  });
});
