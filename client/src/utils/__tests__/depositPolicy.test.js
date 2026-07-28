import { describe, expect, it } from "vitest";

import { normalizeDepositPolicyResponse } from "../depositPolicy";

describe("deposit policy client contract", () => {
  it("accepts a valid integer VND policy", () => {
    expect(
      normalizeDepositPolicyResponse({
        data: {
          data: {
            currency: "VND",
            minAmount: 5000,
            maxAmount: 100000000,
          },
        },
      }),
    ).toEqual({
      currency: "VND",
      minAmount: 5000,
      maxAmount: 100000000,
    });
  });

  it.each([
    { currency: "USD", minAmount: 5000, maxAmount: 100000000 },
    { currency: "VND", minAmount: "5000", maxAmount: 100000000 },
    { currency: "VND", minAmount: 10000, maxAmount: 5000 },
  ])("rejects malformed policy %#", (data) => {
    expect(() =>
      normalizeDepositPolicyResponse({ data: { data } }),
    ).toThrow("invalid");
  });
});
