import { describe, expect, it, vi } from "vitest";

import { buildTrainerPlanCategories } from "../trainerPlanBenefits";

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
