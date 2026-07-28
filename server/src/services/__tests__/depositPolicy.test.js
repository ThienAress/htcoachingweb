import { describe, expect, it } from "vitest";

import {
  DEPOSIT_POLICY,
  validateDepositAmount,
} from "../../constants/depositPolicy.js";

describe("deposit policy", () => {
  it("keeps integer VND boundaries in one server policy", () => {
    expect(DEPOSIT_POLICY).toEqual({
      currency: "VND",
      minAmount: 5000,
      maxAmount: 100000000,
    });
    expect(validateDepositAmount(4999).valid).toBe(false);
    expect(validateDepositAmount(5000).valid).toBe(true);
    expect(validateDepositAmount(100000000).valid).toBe(true);
    expect(validateDepositAmount(100000001).valid).toBe(false);
    expect(validateDepositAmount(5000.5).valid).toBe(false);
  });
});
