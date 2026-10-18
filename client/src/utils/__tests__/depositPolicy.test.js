import { describe, expect, it } from "vitest";

import {
  calculateDepositPreview,
  normalizeDepositPolicyResponse,
  parseDepositBonusRateDraft,
  selectDepositTier,
} from "../depositPolicy";

const policy = {
  currency: "VND",
  minAmount: 10000,
  maxAmount: 1000000000,
  policyVersion: 3,
  tiers: [
    { key: "starter", minAmount: 10000, bonusRate: 5, label: null },
    { key: "growth", minAmount: 100000, bonusRate: 15, label: null },
    { key: "premium", minAmount: 200000, bonusRate: 20, label: null },
  ],
};

describe("deposit policy client contract", () => {
  it("accepts a valid integer VND policy", () => {
    expect(
      normalizeDepositPolicyResponse({
        data: {
          data: {
            currency: "VND",
            minAmount: 10000,
            maxAmount: 1000000000,
            policyVersion: 3,
            tiers: policy.tiers,
          },
        },
      }),
    ).toEqual({
      currency: "VND",
      minAmount: 10000,
      maxAmount: 1000000000,
      policyVersion: 3,
      tiers: policy.tiers,
    });
  });

  it("accepts moved thresholds and a label, and shows a missing label as null", () => {
    const moved = {
      ...policy,
      tiers: [
        { key: "starter", minAmount: 10000, bonusRate: 5 },
        { key: "growth", minAmount: 150000, bonusRate: 15, label: "Phổ biến" },
        { key: "premium", minAmount: 500000, bonusRate: 20 },
      ],
    };

    const result = normalizeDepositPolicyResponse({ data: { data: moved } });

    expect(result.tiers.map((tier) => tier.minAmount)).toEqual([10000, 150000, 500000]);
    expect(result.tiers.map((tier) => tier.label)).toEqual([null, "Phổ biến", null]);
    expect(selectDepositTier(result, 160000)?.key).toBe("growth");
    expect(selectDepositTier(result, 149000)?.key).toBe("starter");
  });

  it.each([
    { ...policy, currency: "USD" },
    { ...policy, tiers: policy.tiers.map((tier, index) => (index === 0 ? { ...tier, minAmount: 20000 } : tier)) },
    { ...policy, tiers: policy.tiers.map((tier, index) => (index === 1 ? { ...tier, minAmount: 200000 } : tier)) },
    { ...policy, tiers: policy.tiers.map((tier, index) => (index === 1 ? { ...tier, minAmount: 150500 } : tier)) },
    { ...policy, tiers: policy.tiers.map((tier, index) => (index === 2 ? { ...tier, minAmount: 2000000000 } : tier)) },
    { ...policy, tiers: policy.tiers.map((tier, index) => (index === 0 ? { ...tier, label: "x".repeat(41) } : tier)) },
    { ...policy, minAmount: "10000" },
    { ...policy, minAmount: 10000, maxAmount: 5000 },
    { ...policy, policyVersion: 0 },
    { ...policy, tiers: [...policy.tiers].reverse() },
    { ...policy, tiers: policy.tiers.map((tier, index) => index === 1 ? { ...tier, bonusRate: 4 } : tier) },
  ])("rejects malformed policy %#", (data) => {
    expect(() =>
      normalizeDepositPolicyResponse({ data: { data } }),
    ).toThrow("invalid");
  });

  it.each([
    [10000, "starter", 500, 10500],
    [100000, "growth", 15000, 115000],
    [200000, "premium", 40000, 240000],
  ])("previews the highest eligible tier for %i", (amount, key, bonusAmount, creditedAmount) => {
    expect(selectDepositTier(policy, amount)?.key).toBe(key);
    expect(calculateDepositPreview(policy, amount)).toMatchObject({
      amount,
      bonusTierKey: key,
      bonusAmount,
      creditedAmount,
    });
  });

  it("does not treat an empty admin rate as zero", () => {
    expect(parseDepositBonusRateDraft("")).toBeNull();
    expect(parseDepositBonusRateDraft("  ")).toBeNull();
    expect(parseDepositBonusRateDraft("0")).toBe(0);
    expect(parseDepositBonusRateDraft("20")).toBe(20);
    expect(parseDepositBonusRateDraft("20.5")).toBeNull();
  });
});
