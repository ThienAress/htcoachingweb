import { describe, expect, test } from "vitest";

import { isMongoIndexContractEquivalent } from "../mongoIndexContract.js";

const contract = {
  keys: { clientId: 1, weekStartDateKey: 1 },
  options: { unique: true },
};

const existingIndex = (overrides = {}) => ({
  key: { clientId: 1, weekStartDateKey: 1 },
  name: "legacy_index_name",
  unique: true,
  ...overrides,
});

describe("Mongo index contract equivalence", () => {
  test("ignores the index name when keys and protective options match", () => {
    expect(isMongoIndexContractEquivalent(existingIndex(), contract)).toBe(true);
  });

  test.each([
    ["key order", { key: { weekStartDateKey: 1, clientId: 1 } }],
    ["unique", { unique: false }],
    ["sparse", { sparse: true }],
    [
      "partial filter",
      { partialFilterExpression: { clientId: { $exists: true } } },
    ],
    ["TTL", { expireAfterSeconds: 3600 }],
    ["collation", { collation: { locale: "vi", strength: 2 } }],
  ])("rejects a mismatch in %s", (_label, overrides) => {
    expect(
      isMongoIndexContractEquivalent(existingIndex(overrides), contract),
    ).toBe(false);
  });

  test("normalizes nested option object key order", () => {
    const partialContract = {
      ...contract,
      options: {
        unique: true,
        partialFilterExpression: {
          clientId: { $exists: true, $type: "objectId" },
        },
      },
    };
    const existing = existingIndex({
      partialFilterExpression: {
        clientId: { $type: "objectId", $exists: true },
      },
    });

    expect(isMongoIndexContractEquivalent(existing, partialContract)).toBe(true);
  });
});
