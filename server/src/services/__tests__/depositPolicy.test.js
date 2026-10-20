import { describe, expect, it } from "vitest";

import {
  DEPOSIT_POLICY,
  buildDepositPolicy,
  validateDepositTierLabels,
  validateDepositTierMinimums,
  calculateDepositCreditSnapshot,
  resolveDepositTier,
  validateDepositBonusRates,
  validateDepositAmount,
} from "../../constants/depositPolicy.js";

describe("deposit policy", () => {
  it("keeps integer VND boundaries in one server policy", () => {
    expect(DEPOSIT_POLICY).toEqual({
      currency: "VND",
      minAmount: 10000,
      maxAmount: 1000000000,
      policyVersion: 1,
      tiers: [
        { key: "starter", minAmount: 10000, bonusRate: 10, label: null },
        { key: "growth", minAmount: 100000, bonusRate: 15, label: null },
        { key: "premium", minAmount: 200000, bonusRate: 20, label: null },
      ],
    });
    expect(validateDepositAmount(9999).valid).toBe(false);
    expect(validateDepositAmount(10000).valid).toBe(true);
    expect(validateDepositAmount(1000000000).valid).toBe(true);
    expect(validateDepositAmount(1000000001).valid).toBe(false);
    expect(validateDepositAmount(10000.5).valid).toBe(false);
  });

  it.each([
    [10000, "starter", 10000, 10, 1000, 11000],
    [99999, "starter", 10000, 10, 9999, 109998],
    [100000, "growth", 100000, 15, 15000, 115000],
    [199999, "growth", 100000, 15, 29999, 229998],
    [200000, "premium", 200000, 20, 40000, 240000],
    [1000000000, "premium", 200000, 20, 200000000, 1200000000],
  ])(
    "selects the highest eligible tier for %i VND",
    (amount, key, tierMinAmount, bonusRate, bonusAmount, creditedAmount) => {
      expect(resolveDepositTier(DEPOSIT_POLICY, amount)?.key).toBe(key);
      expect(calculateDepositCreditSnapshot(DEPOSIT_POLICY, amount)).toEqual({
        bonusTierKey: key,
        bonusTierMinAmount: tierMinAmount,
        bonusRate,
        bonusAmount,
        creditedAmount,
        policyVersion: 1,
      });
    },
  );

  it("validates all rates atomically and requires non-decreasing tiers", () => {
    expect(validateDepositBonusRates({ starter: 5, growth: 15, premium: 20 }))
      .toEqual({ valid: true, rates: { starter: 5, growth: 15, premium: 20 } });
    expect(validateDepositBonusRates({ starter: 10, growth: 9, premium: 20 }))
      .toMatchObject({ valid: false, code: "DEPOSIT_BONUS_RATES_NOT_MONOTONIC" });
    expect(validateDepositBonusRates({ starter: 10, growth: 15 }))
      .toMatchObject({ valid: false, code: "INVALID_DEPOSIT_BONUS_RATES" });
    expect(validateDepositBonusRates({ starter: 10, growth: 15, premium: 20, extra: 25 }))
      .toMatchObject({ valid: false, code: "INVALID_DEPOSIT_BONUS_RATES" });
    expect(validateDepositBonusRates({ starter: "10", growth: 15, premium: 20 }))
      .toMatchObject({ valid: false, code: "INVALID_DEPOSIT_BONUS_RATES" });
    expect(validateDepositBonusRates({ starter: -1, growth: 15, premium: 20 }))
      .toMatchObject({ valid: false, code: "INVALID_DEPOSIT_BONUS_RATES" });
    expect(validateDepositBonusRates({ starter: 10, growth: 15, premium: 101 }))
      .toMatchObject({ valid: false, code: "INVALID_DEPOSIT_BONUS_RATES" });
    expect(validateDepositBonusRates({ starter: 10, growth: 15, premium: 20.5 }))
      .toMatchObject({ valid: false, code: "INVALID_DEPOSIT_BONUS_RATES" });
  });
});

describe("deposit tier thresholds and labels", () => {
  it("lets the second and third thresholds move while the first stays at the minimum deposit", () => {
    expect(validateDepositTierMinimums({ growth: 150000, premium: 500000 })).toEqual({
      valid: true,
      minimums: { starter: 10000, growth: 150000, premium: 500000 },
    });
  });

  it.each([
    [{ growth: 10000, premium: 200000 }],
    [{ growth: 200000, premium: 200000 }],
    [{ growth: 300000, premium: 200000 }],
    [{ growth: 150500, premium: 300000 }],
    [{ growth: 150000, premium: 1000001000 }],
    [{ growth: 150000, premium: "300000" }],
    [{ growth: 150000 }],
    [{ starter: 20000, growth: 150000, premium: 300000 }],
    [null],
  ])("refuses thresholds that break the ladder %j", (thresholds) => {
    expect(validateDepositTierMinimums(thresholds)).toMatchObject({
      valid: false,
      code: "INVALID_DEPOSIT_TIER_MINIMUMS",
    });
  });

  it("trims names, treats a missing name as the default and refuses long or control-character names", () => {
    expect(validateDepositTierLabels({ starter: "  Khởi   đầu ", premium: "Cao cấp" })).toEqual({
      valid: true,
      labels: { starter: "Khởi đầu", growth: "", premium: "Cao cấp" },
    });
    expect(validateDepositTierLabels({ starter: "x".repeat(41) }).valid).toBe(false);
    expect(validateDepositTierLabels({ starter: "a\u0000b" }).valid).toBe(false);
    expect(validateDepositTierLabels({ gold: "Vàng" }).valid).toBe(false);
    expect(validateDepositTierLabels({ starter: 7 }).valid).toBe(false);
  });

  it("prices a deposit by the moved thresholds and records the tier minimum in the snapshot", () => {
    const policy = buildDepositPolicy({
      rates: { starter: 10, growth: 15, premium: 20 },
      minimums: { starter: 10000, growth: 150000, premium: 500000 },
      labels: { starter: "", growth: "Phổ biến", premium: "" },
      policyVersion: 5,
    });

    expect(calculateDepositCreditSnapshot(policy, 149999)).toMatchObject({
      bonusTierKey: "starter",
      bonusTierMinAmount: 10000,
    });
    expect(calculateDepositCreditSnapshot(policy, 150000)).toEqual({
      bonusTierKey: "growth",
      bonusTierMinAmount: 150000,
      bonusRate: 15,
      bonusAmount: 22500,
      creditedAmount: 172500,
      policyVersion: 5,
    });
    expect(policy.tiers.map((tier) => tier.label)).toEqual([null, "Phổ biến", null]);
  });
});
