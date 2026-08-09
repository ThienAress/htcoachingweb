import { describe, expect, it } from "vitest";

import {
  formatPolicy,
  formatTrainerBenefitValue,
  formatTrainerPlanPrice,
  groupColumnPolicies,
} from "../serviceAccessPolicyPresentation.js";

describe("service access policy presentation", () => {
  it("formats quota and unlimited policies without hardcoded service values", () => {
    expect(
      formatPolicy({
        mode: "quota",
        limit: 3,
        unitLabel: "lượt",
        periodLabel: "24 giờ",
        scopeLabel: "user",
      }),
    ).toEqual({ primary: "3 lượt / 24 giờ", secondary: "Theo user" });

    expect(formatPolicy({ mode: "unlimited" })).toEqual({
      primary: "Không giới hạn",
      secondary: "",
    });
  });

  it("formats trainer plan headers and benefit values", () => {
    expect(
      formatTrainerPlanPrice({
        prices: { trial: 0 },
        durationDays: 30,
      }),
    ).toBe("Miễn phí · 30 ngày");
    expect(
      formatTrainerPlanPrice({
        prices: { month: 250000, year: 2500000 },
        durationDays: null,
      }),
    ).toBe("250.000 ₫/tháng · 2.500.000 ₫/năm");
    expect(formatTrainerBenefitValue(20, { valueType: "capacity" })).toBe(
      "20 học viên",
    );
    expect(formatTrainerBenefitValue(true, { valueType: "included" })).toBe(
      "Có",
    );
    expect(formatTrainerBenefitValue(false, { valueType: "included" })).toBe(
      "Không",
    );
  });

  it("groups paid tiers when their policies match and separates future drift", () => {
    const samePolicy = {
      mode: "quota",
      limit: 10,
      unitLabel: "lượt",
      periodLabel: "24 giờ",
      scopeLabel: "user",
    };
    const row = {
      policies: {
        coaching_customer: samePolicy,
        trainer: { ...samePolicy },
      },
    };
    const column = {
      tiers: [
        { key: "coaching_customer", label: "User có gói" },
        { key: "trainer", label: "HLV" },
      ],
    };

    expect(groupColumnPolicies(row, column)).toHaveLength(1);
    row.policies.trainer = { ...samePolicy, limit: 30 };
    expect(groupColumnPolicies(row, column)).toHaveLength(2);
  });
});
