const normalizeNestedValue = (value) => {
  if (Array.isArray(value)) return value.map(normalizeNestedValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, normalizeNestedValue(value[key])]),
  );
};

export const comparableMongoIndexOptions = (value = {}) => ({
  unique: Boolean(value.unique),
  sparse: Boolean(value.sparse),
  partialFilterExpression: normalizeNestedValue(
    value.partialFilterExpression ?? null,
  ),
  expireAfterSeconds:
    value.expireAfterSeconds == null ? null : Number(value.expireAfterSeconds),
  collation: normalizeNestedValue(value.collation ?? null),
});

export const isMongoIndexContractEquivalent = (existing, contract) =>
  JSON.stringify(existing?.key) === JSON.stringify(contract.keys) &&
  JSON.stringify(comparableMongoIndexOptions(existing)) ===
    JSON.stringify(comparableMongoIndexOptions(contract.options));
