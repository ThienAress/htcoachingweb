import { describe, expect, it } from "vitest";

import {
  DEPOSIT_POLICY,
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
        { key: "starter", minAmount: 10000, bonusRate: 10 },
        { key: "growth", minAmount: 100000, bonusRate: 15 },
        { key: "premium", minAmount: 200000, bonusRate: 20 },
      ],
    });
    expect(validateDepositAmount(9999).valid).toBe(false);
    expect(validateDepositAmount(10000).valid).toBe(true);
    expect(validateDepositAmount(1000000000).valid).toBe(true);
    expect(validateDepositAmount(1000000001).valid).toBe(false);
    expect(validateDepositAmount(10000.5).valid).toBe(false);
  });

  it.each([
    [10000, "starter", 10, 1000, 11000],
    [99999, "starter", 10, 9999, 109998],
    [100000, "growth", 15, 15000, 115000],
    [199999, "growth", 15, 29999, 229998],
    [200000, "premium", 20, 40000, 240000],
    [1000000000, "premium", 20, 200000000, 1200000000],
  ])(
    "selects the highest eligible tier for %i VND",
    (amount, key, bonusRate, bonusAmount, creditedAmount) => {
      expect(resolveDepositTier(DEPOSIT_POLICY, amount)?.key).toBe(key);
      expect(calculateDepositCreditSnapshot(DEPOSIT_POLICY, amount)).toEqual({
        bonusTierKey: key,
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
