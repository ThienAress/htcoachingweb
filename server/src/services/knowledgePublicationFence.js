import { createHash } from "crypto";
import mongoose from "mongoose";

// Explicit projection of every persisted KnowledgeEntry field that can affect
// the approved publication or its later reconciliation.
export const KNOWLEDGE_PUBLICATION_FIELDS = Object.freeze([
  "_id", "question", "normalizedQuestion", "answer", "category", "status",
  "reviewStatus", "evidenceLevel", "sources", "reviewedBy", "reviewedAt",
  "reviewDueAt", "freshnessClass", "revision", "updatedAt", "__v",
  "embeddingStatus", "embeddingVersion", "variantCount", "variants", "tags",
  "embedding", "embeddingUpdatedAt", "embeddingError", "source", "createdBy",
]);

export const knowledgePublicationProjection = Object.freeze(
  Object.fromEntries(KNOWLEDGE_PUBLICATION_FIELDS.map((field) => [field, 1])),
);

const ejson = mongoose.mongo.BSON.EJSON;
const bsonTypes = Object.freeze({
  Double: "double", Int32: "int", Long: "long", Decimal128: "decimal",
  ObjectId: "objectId", Binary: "binData", Timestamp: "timestamp",
  MinKey: "minKey", MaxKey: "maxKey", BSONRegExp: "regex",
});

const valueType = (value) => {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (value instanceof Date) return "date";
  if (value?._bsontype) {
    const type = bsonTypes[value._bsontype];
    if (!type) throw new TypeError("Unsupported knowledge publication BSON type");
    return type;
  }
  if (typeof value === "number") return "double";
  if (typeof value === "boolean") return "bool";
  if (typeof value === "string") return "string";
  if (typeof value === "object") return "object";
  throw new TypeError("Unsupported knowledge publication field type");
};

const projectedSnapshot = (raw) => Object.fromEntries(
  KNOWLEDGE_PUBLICATION_FIELDS
    .filter((field) => Object.hasOwn(raw, field))
    .map((field) => [field, raw[field]]),
);

const typeGuard = (expression, value, budget, depth = 0) => {
  if (depth > 12 || --budget.nodes < 0) throw new RangeError("Knowledge publication snapshot too large");
  const type = valueType(value);
  const checks = [];
  if (type === "array") {
    if (value.length > 10000) throw new RangeError("Knowledge publication array too large");
    checks.push({ $eq: [{ $size: expression }, value.length] });
    checks.push({ $eq: [
      { $map: { input: expression, as: "item", in: { $type: "$$item" } } },
      { $literal: value.map(valueType) },
    ] });
    value.forEach((item, index) => {
      const childType = valueType(item);
      if (childType === "object" || childType === "array") {
        checks.push(typeGuard({ $arrayElemAt: [expression, index] }, item, budget, depth + 1));
      }
    });
  } else if (type === "object") {
    const keys = Object.keys(value);
    checks.push({ $eq: [
      { $map: { input: { $objectToArray: expression }, as: "pair", in: "$$pair.k" } },
      { $literal: keys },
    ] });
    for (const key of keys) {
      checks.push(typeGuard({ $getField: { field: { $literal: key }, input: expression } }, value[key], budget, depth + 1));
    }
  }
  const matchesType = { $eq: [{ $type: expression }, type] };
  return checks.length
    ? { $cond: [matchesType, { $and: checks }, false] }
    : matchesType;
};

export const knowledgePublicationTag = (raw) => {
  const budget = { nodes: 20000 };
  for (const field of KNOWLEDGE_PUBLICATION_FIELDS) {
    if (Object.hasOwn(raw, field)) typeGuard(`$${field}`, raw[field], budget);
  }
  const canonical = ejson.stringify(projectedSnapshot(raw), { relaxed: false });
  if (Buffer.byteLength(canonical, "utf8") > 1_000_000) {
    throw new RangeError("Knowledge publication snapshot too large");
  }
  const digest = createHash("sha256").update(canonical, "utf8").digest("hex");
  return `"kb-publish-v1-${digest}"`;
};

export const validKnowledgePublicationTag = (value) =>
  typeof value === "string" && /^"kb-publish-v1-[a-f0-9]{64}"$/.test(value);

// This object is server-built from the raw BSON snapshot. It is assigned to a
// document's $where property; it is never a MongoDB JavaScript $where query.
export const knowledgePublicationSaveFilter = (raw) => {
  const budget = { nodes: 20000 };
  return {
    $expr: {
      $and: KNOWLEDGE_PUBLICATION_FIELDS.map((field) => {
        const present = Object.hasOwn(raw, field);
        const checks = [present
          ? typeGuard(`$${field}`, raw[field], budget)
          : { $eq: [{ $type: `$${field}` }, "missing"] }];
        if (present) checks.push({ $eq: [`$${field}`, { $literal: raw[field] }] });
        return { $and: checks };
      }),
    },
  };
};
