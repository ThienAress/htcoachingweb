import { describe, expect, it, vi } from "vitest";

import { buildTrainerPlanCategories, splitTrainerPlanBenefits } from "../trainerPlanBenefits";

describe("trainer plan benefit presentation", () => {
  const benefits = [
    {
      key: "max_students",
      category: { key: "student_management", label: "Quản lý học viên" },
      valueType: "capacity",
      includedPlanCodes: ["free", "professional"],
    },
    {
      key: "create_profile",
      category: { key: "student_management", label: "Quản lý học viên" },
      valueType: "included",
      includedPlanCodes: ["free", "professional"],
    },
    {
      key: "crm_ai_analysis",
      category: { key: "crm_ai", label: "F1 CRM & AI" },
      valueType: "included",
      includedPlanCodes: ["professional"],
    },
  ];

  it("groups only benefits included by the selected plan", () => {
    const t = vi.fn((key, params) =>
      params?.count ? `${key}:${params.count}` : key,
    );

    expect(
      buildTrainerPlanCategories({
        plan: { code: "free", maxClients: 3 },
        benefits,
        t,
      }),
    ).toEqual([
      {
        key: "student_management",
        name: "pricing.trainer_plans.categories.student_management",
        features: [
          "pricing.trainer_plans.features.max_students:3",
          "pricing.trainer_plans.features.create_profile",
        ],
      },
    ]);
  });
});

describe("splitTrainerPlanBenefits", () => {
  const plans = [{ code: "free" }, { code: "standard" }, { code: "professional" }];
  const benefits = [
    { key: "max_students", category: { key: "student_management" }, valueType: "capacity", includedPlanCodes: ["free", "standard", "professional"] },
    { key: "create_profile", category: { key: "student_management" }, valueType: "included", includedPlanCodes: ["free", "standard", "professional"] },
    { key: "dashboard", category: { key: "coaching_schedule" }, valueType: "included", includedPlanCodes: ["free", "standard", "professional"] },
    { key: "crm_leads", category: { key: "crm_ai" }, valueType: "included", includedPlanCodes: ["professional"] },
    { key: "crm_ai_report", category: { key: "crm_ai" }, valueType: "included", includedPlanCodes: ["professional"] },
  ];
  const t = (key) => key.replace("pricing.trainer_plans.", "");

  it("lists what every plan has once and leaves capacity out", () => {
    const { shared } = splitTrainerPlanBenefits({ plans, benefits, t });

    expect(shared.map((category) => category.key)).toEqual(["student_management", "coaching_schedule"]);
    expect(shared[0].features).toEqual(["features.create_profile"]);
    expect(JSON.stringify(shared)).not.toContain("max_students");
  });

  it("gives each plan only the benefits not shared by all, with the category icon", () => {
    const { perPlan } = splitTrainerPlanBenefits({ plans, benefits, t });

    expect(perPlan.free).toEqual([]);
    expect(perPlan.standard).toEqual([]);
    expect(perPlan.professional).toEqual([
      { key: "crm_ai", name: "categories.crm_ai", icon: "✨", features: ["features.crm_leads", "features.crm_ai_report"] },
    ]);
  });

  it("returns empty groups for missing data", () => {
    expect(splitTrainerPlanBenefits({ plans: [], benefits, t })).toEqual({ shared: [], perPlan: {} });
    expect(splitTrainerPlanBenefits({ plans, benefits: undefined, t })).toEqual({ shared: [], perPlan: {} });
  });
});
