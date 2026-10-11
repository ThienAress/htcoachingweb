import { createHash } from "node:crypto";
import mongoose from "mongoose";
import KnowledgeEntry from "../models/KnowledgeEntry.js";
import { generateEmbedding } from "./ai/embedding.service.js";
import { EMBEDDING_DIMENSION, EMBEDDING_VERSION } from "./ai/embeddingProfile.js";
import { prepareKnowledgeRetrievalQuery, validateKnowledgeEntryPrivacy } from "./ai/knowledgePrivacy.js";
import { normalizeKnowledgeQuestion, parseKnowledgeEntryPayload, validateKnowledgePublication } from "../utils/knowledgeBase.js";
import { knowledgePublicationProjection, knowledgePublicationSaveFilter, knowledgePublicationTag, validKnowledgePublicationTag } from "./knowledgePublicationFence.js";

const EDITORIAL_FIELDS = new Set(["question", "answer", "category", "variants", "tags", "sources"]);
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const snapshot = (entry) => ({
  question: entry.question, answer: entry.answer,
  variants: (entry.variants || []).map((item) => item.text ?? item),
  tags: entry.tags || [], sources: entry.sources || [],
});
// Retains the approved private candidate builder's content-hash contract.
export const knowledgeEditorialContentHash = (entry) => digest(snapshot(entry));
const dateValue = (value) => value ? new Date(value).toISOString() : null;
// Intent reconciliation also binds category and normalizes persisted source defaults/dates.
export const knowledgeEditorialHash = (entry) => digest({
  category: entry.category, ...snapshot(entry),
  sources: (entry.sources || []).map((source) => ({
    type: source.type, title: source.title, publisher: source.publisher,
    url: source.url || null, publishedAt: dateValue(source.publishedAt),
    retrievedAt: dateValue(source.retrievedAt), evidenceTier: source.evidenceTier,
  })),
});

export class KnowledgeEditorialError extends Error {
  constructor(code, status) { super(code); this.code = code; this.status = status; }
}
const invalid = () => new KnowledgeEditorialError("KNOWLEDGE_EDITORIAL_PRECONDITION_INVALID", 400);
const conflict = () => new KnowledgeEditorialError("KNOWLEDGE_EDITORIAL_PRECONDITION_FAILED", 412);
const embeddingFailed = () => new KnowledgeEditorialError("KNOWLEDGE_EDITORIAL_EMBEDDING_FAILED", 503);
const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);
const revisionOf = (raw) => {
  const value = raw.revision;
  if (typeof value !== "number" && !["Int32", "Double", "Long"].includes(value?._bsontype)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
};
const readRaw = (id) => KnowledgeEntry.collection.findOne(
  { _id: new mongoose.Types.ObjectId(id) },
  { projection: knowledgePublicationProjection, promoteValues: false },
);
const metadata = (raw) => ({
  entryId: String(raw._id), contentHash: knowledgeEditorialContentHash(raw),
  editorialHash: knowledgeEditorialHash(raw), revision: revisionOf(raw),
  status: raw.status, reviewStatus: raw.reviewStatus,
  embeddingStatus: raw.embeddingStatus, embeddingVersion: raw.embeddingVersion,
  publicationTag: knowledgePublicationTag(raw),
});

export async function getKnowledgeEditorialState(id) {
  const raw = await readRaw(id);
  if (!raw) throw new KnowledgeEditorialError("KNOWLEDGE_EDITORIAL_NOT_FOUND", 404);
  return metadata(raw);
}

const validateEnvelope = (body, tag) => {
  if (!validKnowledgePublicationTag(tag) || !isObject(body) ||
      Object.keys(body).length !== 3 || !Object.hasOwn(body, "patch") ||
      !/^[a-f0-9]{64}$/.test(body.expectedHash || "") ||
      !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 1 ||
      !isObject(body.patch) || !Object.keys(body.patch).length ||
      Object.keys(body.patch).some((field) => !EDITORIAL_FIELDS.has(field))) throw invalid();
  for (const field of ["variants", "tags"]) {
    if (Object.hasOwn(body.patch, field) && (!Array.isArray(body.patch[field]) ||
        body.patch[field].some((text) => typeof text !== "string" || !text.trim()))) throw invalid();
  }
};
const validVector = (value) => Array.isArray(value) && value.length === EMBEDDING_DIMENSION &&
  value.every(Number.isFinite) && value.some((number) => number !== 0);

export async function repairKnowledgeEditorialDraft(id, body, tag, { signal, deadlineAt } = {}) {
  validateEnvelope(body, tag);
  const raw = await readRaw(id);
  if (!raw || raw.status !== "draft" || revisionOf(raw) !== body.expectedRevision ||
      knowledgeEditorialContentHash(raw) !== body.expectedHash || knowledgePublicationTag(raw) !== tag) throw conflict();
  if (signal?.aborted) throw embeddingFailed();
  const parsed = parseKnowledgeEntryPayload({ ...body.patch, question: body.patch.question ?? raw.question }, { partial: true });
  if (parsed.error) throw invalid();
  const current = snapshot(raw);
  const patch = parsed.value;
  const candidate = { ...raw, ...patch, variants: patch.variants ?? current.variants };
  if (!validateKnowledgeEntryPrivacy(candidate).valid) {
    throw new KnowledgeEditorialError("KNOWLEDGE_QUERY_SENSITIVE", 400);
  }
  const publication = validateKnowledgePublication(candidate);
  if (!publication.valid && publication.code !== "KNOWLEDGE_EMBEDDING_VERSION_MISMATCH") {
    throw new KnowledgeEditorialError(publication.code, 409);
  }
  const normalizedQuestion = normalizeKnowledgeQuestion(candidate.question);
  if (normalizedQuestion !== raw.normalizedQuestion && await KnowledgeEntry.exists({
    _id: { $ne: raw._id }, normalizedQuestion,
  })) throw new KnowledgeEditorialError("KNOWLEDGE_DUPLICATE", 409);
  const changed = knowledgeEditorialHash(candidate) !== knowledgeEditorialHash(raw);
  if (!changed) return metadata(raw);
  const embeddingChanged = candidate.question !== raw.question ||
    JSON.stringify(candidate.variants) !== JSON.stringify(current.variants);
  let vectors;
  if (embeddingChanged) {
    const inputs = [candidate.question, ...candidate.variants].map(prepareKnowledgeRetrievalQuery);
    if (inputs.some((input) => !input.eligible || input.redacted)) {
      throw new KnowledgeEditorialError("KNOWLEDGE_QUERY_SENSITIVE", 400);
    }
    const values = [];
    try {
      for (const input of inputs) {
        if (signal?.aborted) throw embeddingFailed();
        const remaining = deadlineAt === undefined ? 60_000 : deadlineAt - Date.now();
        if (!Number.isFinite(remaining) || remaining <= 0) throw embeddingFailed();
        const vector = await generateEmbedding(input.query, { signal, timeoutMs: remaining });
        if (!validVector(vector)) throw embeddingFailed();
        values.push(vector);
      }
      vectors = { embedding: values[0], variants: candidate.variants.map((text, index) => ({ text, embedding: values[index + 1] })) };
    } catch { throw embeddingFailed(); }
  }
  if (signal?.aborted || (deadlineAt !== undefined && Date.now() >= deadlineAt)) throw embeddingFailed();
  // Hydration gets its own BSON-preserving copy; the original CAS snapshot stays immutable.
  const ejson = mongoose.mongo.BSON.EJSON;
  const entry = KnowledgeEntry.hydrate(ejson.parse(ejson.stringify(raw, { relaxed: false }), { relaxed: false }), knowledgePublicationProjection);
  for (const field of ["question", "answer", "category", "tags", "sources"]) {
    if (Object.hasOwn(patch, field)) entry[field] = patch[field];
  }
  if (vectors) {
    entry.embedding = vectors.embedding;
    entry.variants = vectors.variants;
    entry.embeddingStatus = "ready";
    entry.embeddingVersion = EMBEDDING_VERSION;
    entry.embeddingUpdatedAt = new Date();
    entry.embeddingError = null;
  }
  entry.revision = body.expectedRevision + 1;
  entry.status = "draft";
  entry.reviewStatus = "needs_review";
  entry.reviewedBy = null;
  entry.reviewedAt = null;
  entry.$where = knowledgePublicationSaveFilter(raw);
  try { await entry.save(); } catch (error) {
    if (["VersionError", "DocumentNotFoundError"].includes(error?.name)) throw conflict();
    if (error?.code === 11000) throw new KnowledgeEditorialError("KNOWLEDGE_DUPLICATE", 409);
    if (error?.name === "ValidationError") throw invalid();
    throw error;
  }
  return getKnowledgeEditorialState(id);
}
