import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import {
  knowledgePublicationSaveFilter,
  knowledgePublicationTag,
  validKnowledgePublicationTag,
} from "../knowledgePublicationFence.js";

const { ObjectId, Int32, Double } = mongoose.mongo.BSON;

describe("knowledge publication fence", () => {
  const raw = () => ({
    _id: new ObjectId("507f1f77bcf86cd799439011"),
    question: "Approved question",
    answer: "Approved answer",
    status: "draft",
    sources: [{ title: "Source", publishedAt: new Date("2026-01-01") }],
    variants: [],
    __v: new Int32(2),
  });

  it("uses a strict quoted strong tag and rejects weak or malformed tags", () => {
    const tag = knowledgePublicationTag(raw());
    expect({ valid: validKnowledgePublicationTag(tag), weak: validKnowledgePublicationTag(`W/${tag}`), bare: validKnowledgePublicationTag(tag.slice(1, -1)) })
      .toEqual({ valid: true, weak: false, bare: false });
  });

  it("distinguishes absent, null, and BSON numeric types in the digest", () => {
    const base = raw();
    expect(new Set([
      knowledgePublicationTag(base),
      knowledgePublicationTag({ ...base, reviewedAt: null }),
      knowledgePublicationTag({ ...base, __v: new Double(2) }),
    ]).size).toBe(3);
  });

  it("binds ordered arrays, BSON dates, and ObjectIds", () => {
    const base = raw();
    expect(new Set([
      knowledgePublicationTag(base),
      knowledgePublicationTag({ ...base, sources: [...base.sources, { title: "Second" }] }),
      knowledgePublicationTag({ ...base, sources: [{ ...base.sources[0], publishedAt: new Date("2026-01-02") }] }),
      knowledgePublicationTag({ ...base, _id: new ObjectId("507f1f77bcf86cd799439012") }),
    ]).size).toBe(4);
  });

  it("builds only server-owned expression predicates, with nested type guards", () => {
    const filter = knowledgePublicationSaveFilter({ ...raw(), variants: [{ "$raw": [new Int32(1)] }] });
    const serialized = JSON.stringify(filter);
    expect({ expression: Object.hasOwn(filter, "$expr"), javascriptWhere: serialized.includes('"$where"'), nestedType: serialized.includes('"$$item"'), literalKey: serialized.includes('"field":{"$literal":"$raw"}') })
      .toEqual({ expression: true, javascriptWhere: false, nestedType: true, literalKey: true });
  });

  it("fails closed on unsupported or oversized raw values", () => {
    expect([
      () => knowledgePublicationTag({ ...raw(), answer: Symbol("unexpected") }),
      () => knowledgePublicationTag({ ...raw(), answer: "a".repeat(1_000_001) }),
      () => knowledgePublicationSaveFilter({ ...raw(), variants: Array.from({ length: 10_001 }, () => "x") }),
    ].map((run) => { try { run(); return false; } catch { return true; } }))
      .toEqual([true, true, true]);
  });
});
