import { describe, expect, it } from "vitest";

import {
  calculateFitnessPlusPlanEndDate,
  createFitnessPlusCatalogFingerprint,
  getFitnessPlusPlanAmount,
  getFitnessPlusCatalogMeta,
  listFitnessPlusPlans,
  resolveFitnessPlusPlanCode,
} from "../fitnessPlusCatalog.service.js";

describe("HT Fitness+ catalog", () => {
  it("publishes the three canonical plans and stable metadata", () => {
    const plans = listFitnessPlusPlans();
    expect(plans.map((plan) => plan.code)).toEqual([
      "fitness_plus_essential",
      "fitness_plus_smart",
      "fitness_plus_max",
    ]);
    expect(plans.map((plan) => plan.title)).toEqual([
      "Nền tảng",
      "Tăng tốc",
      "Toàn diện",
    ]);
    expect(getFitnessPlusCatalogMeta().catalogFingerprint).toBe(
      createFitnessPlusCatalogFingerprint(),
    );
    expect(plans.map(({ quotas }) => quotas.aiChat.limit)).toEqual([20, 40, 60]);
    expect(plans.map(({ quotas }) => quotas.mealScan.limit)).toEqual([15, 30, 60]);
  });

  it("includes quota policy in the checkout catalog fingerprint", () => {
    const policyResolver = (aiLimit) => (serviceKey) => ({
      mode: "quota",
      limit: serviceKey === "ai_chat" ? aiLimit : 15,
      period: serviceKey === "ai_chat" ? "rolling_hour" : "rolling_30_days",
      windowMs: serviceKey === "ai_chat" ? 3_600_000 : 2_592_000_000,
    });

    expect(
      createFitnessPlusCatalogFingerprint(undefined, policyResolver(20)),
    ).not.toBe(
      createFitnessPlusCatalogFingerprint(undefined, policyResolver(21)),
    );
  });

  it("resolves localized labels and canonical prices", () => {
    expect(resolveFitnessPlusPlanCode("fitness_plus_smart")).toBe(
      "fitness_plus_smart",
    );
    expect(resolveFitnessPlusPlanCode("Tăng tốc")).toBe(
      "fitness_plus_smart",
    );
    expect(resolveFitnessPlusPlanCode("Smart")).toBe("fitness_plus_smart");
    expect(getFitnessPlusPlanAmount("fitness_plus_max", "month")).toBe(299000);
    expect(getFitnessPlusPlanAmount("fitness_plus_max", "trial")).toBeNull();
  });

  it("calculates month and year end dates without mutating the start date", () => {
    const start = new Date("2026-01-31T00:00:00.000Z");
    expect(
      calculateFitnessPlusPlanEndDate("fitness_plus_essential", "month", start),
    ).toEqual(new Date("2026-02-28T00:00:00.000Z"));
    expect(
      calculateFitnessPlusPlanEndDate("fitness_plus_essential", "year", start),
    ).toEqual(new Date("2027-01-31T00:00:00.000Z"));
    expect(start).toEqual(new Date("2026-01-31T00:00:00.000Z"));
  });
});
