import { createHash } from "node:crypto";

const canonicalValue = (value) => {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value.toHexString === "function") {
    return value.toHexString();
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .filter((key) => value[key] !== undefined)
        .sort()
        .map((key) => [key, canonicalValue(value[key])]),
    );
  }
  return value;
};

const sortRows = (rows) =>
  [...(rows || [])].sort((left, right) => {
    const leftKey = `${String(left?._id || "")}\u0000${String(left?.name || "")}`;
    const rightKey = `${String(right?._id || "")}\u0000${String(right?.name || "")}`;
    return leftKey.localeCompare(rightKey);
  });

export const createStagingSearchIndexCohortSnapshotDigest = ({
  fixtureVersion,
  operation,
  sourceExercises = [],
  targetExercises = [],
  reviewCounts = {},
} = {}) => {
  const payload = canonicalValue({
    schemaVersion: 1,
    fixtureVersion,
    operation,
    sourceExercises: sortRows(sourceExercises),
    targetExercises: sortRows(targetExercises),
    reviewCounts,
  });
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
};
