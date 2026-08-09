import { describe, expect, it } from "vitest";

import {
  calculateTrainerPlanEndDate,
  createTrainerCatalogFingerprint,
  getTrainerPlanCatalogMeta,
  getTrainerPlan,
  listTrainerPlanBenefits,
  listTrainerPlans,
  resolveTrainerPlanCode,
} from "../trainerPlanCatalog.service.js";

describe("trainer plan catalog", () => {
  it("keeps backend prices and limits aligned with the approved pricing", () => {
    expect(listTrainerPlans()).toEqual([
      expect.objectContaining({
        code: "free",
        prices: { trial: 0 },
        durationDays: 30,
        maxClients: 3,
      }),
      expect.objectContaining({
        code: "standard",
        prices: { month: 200000, year: 2000000 },
        maxClients: 5,
      }),
      expect.objectContaining({
        code: "professional",
        prices: { month: 250000, year: 2500000 },
        maxClients: 20,
      }),
      expect.objectContaining({
        code: "premium",
        prices: { month: 300000, year: 3000000 },
        maxClients: 50,
      }),
    ]);
  });

  it("resolves legacy Vietnamese titles without changing old subscriptions", () => {
    expect([
      resolveTrainerPlanCode("Tiêu chuẩn"),
      resolveTrainerPlanCode("Chuyên nghiệp"),
      resolveTrainerPlanCode("Cao cấp"),
    ]).toEqual(["standard", "professional", "premium"]);
  });

  it("keeps F1 CRM and AI unavailable on Free and Standard", () => {
    expect({
      free: getTrainerPlan("free").entitlements.f1CrmAi,
      standard: getTrainerPlan("standard").entitlements.f1CrmAi,
      professional: getTrainerPlan("professional").entitlements.f1CrmAi,
      premium: getTrainerPlan("premium").entitlements.f1CrmAi,
    }).toEqual({
      free: false,
      standard: false,
      professional: true,
      premium: true,
    });
  });

  it("keeps the published trainer benefits in one canonical matrix", () => {
    const benefits = listTrainerPlanBenefits();

    expect(benefits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "max_students",
          valueType: "capacity",
          includedPlanCodes: ["free", "standard", "professional", "premium"],
        }),
        expect.objectContaining({
          key: "crm_ai_analysis",
          includedPlanCodes: ["professional", "premium"],
        }),
        expect.objectContaining({
          key: "free_updates",
          includedPlanCodes: ["premium"],
        }),
      ]),
    );
    expect(new Set(benefits.map((benefit) => benefit.key)).size).toBe(
      benefits.length,
    );
  });

  it("changes the deterministic fingerprint when a commercial field changes", () => {
    const plans = listTrainerPlans();
    const benefits = listTrainerPlanBenefits();
    const baseline = createTrainerCatalogFingerprint(plans);
    const reordered = createTrainerCatalogFingerprint([...plans].reverse());
    const changed = createTrainerCatalogFingerprint(
      plans.map((plan) => plan.code === "standard"
        ? { ...plan, prices: { ...plan.prices, month: plan.prices.month + 1 } }
        : plan),
    );

    expect(reordered).toBe(baseline);
    expect(changed).not.toBe(baseline);
    expect(
      createTrainerCatalogFingerprint(
        plans,
        benefits.map((benefit) =>
          benefit.key === "free_updates"
            ? { ...benefit, includedPlanCodes: ["professional", "premium"] }
            : benefit,
        ),
      ),
    ).not.toBe(baseline);
    expect(getTrainerPlanCatalogMeta().catalogFingerprint).toBe(baseline);
  });

  it("clamps calendar billing cycles at month end", () => {
    expect(
      calculateTrainerPlanEndDate(
        "standard",
        "month",
        new Date("2027-01-31T08:30:00.000Z"),
      ).toISOString(),
    ).toBe("2027-02-28T08:30:00.000Z");
    expect(
      calculateTrainerPlanEndDate(
        "standard",
        "year",
        new Date("2028-02-29T08:30:00.000Z"),
      ).toISOString(),
    ).toBe("2029-02-28T08:30:00.000Z");
  });
});
