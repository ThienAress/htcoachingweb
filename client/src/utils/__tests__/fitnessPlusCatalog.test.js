import { describe, expect, it } from "vitest";

import {
  createFitnessPlusPurchasePayload,
  normalizeFitnessPlusCatalogResponse,
} from "../fitnessPlusCatalog";

const catalogResponse = {
  data: {
    data: [
      {
        code: "fitness_plus_essential",
        title: "Nền tảng",
        titleEn: "Essential",
        subtitle: "Bộ công cụ số cốt lõi để tự theo dõi",
        subtitleEn: "Core digital tools for self-tracking",
        prices: { month: 99000, year: 990000 },
        billingCycles: ["month", "year"],
        features: ["core_tools"],
        quotas: {
          aiChat: { limit: 20 },
          mealScan: { limit: 15 },
        },
      },
      {
        code: "fitness_plus_smart",
        title: "Tăng tốc",
        titleEn: "Smart",
        subtitle: "Mức sử dụng cân bằng cho hành trình đều đặn",
        subtitleEn: "Balanced usage for a consistent journey",
        prices: { month: 199000, year: 1990000 },
        billingCycles: ["month", "year"],
        features: ["core_tools"],
        quotas: {
          aiChat: { limit: 40 },
          mealScan: { limit: 30 },
        },
      },
      {
        code: "fitness_plus_max",
        title: "Toàn diện",
        titleEn: "Max",
        subtitle: "Hạn mức rộng cho người dùng công cụ thường xuyên",
        subtitleEn: "More room for frequent tool usage",
        prices: { month: 299000, year: 2990000 },
        billingCycles: ["month", "year"],
        features: ["core_tools"],
        quotas: {
          aiChat: { limit: 60 },
          mealScan: { limit: 60 },
        },
      },
    ],
    meta: {
      currency: "VND",
      catalogFingerprint: "a".repeat(64),
      protocolVersion: 1,
    },
  },
};

describe("HT Fitness+ catalog adapter", () => {
  it("accepts the complete three-plan catalog", () => {
    const catalog = normalizeFitnessPlusCatalogResponse(catalogResponse);
    expect(catalog.byCode.fitness_plus_smart.titleEn).toBe("Smart");
  });

  it("creates a server-confirmed purchase payload", () => {
    const catalog = normalizeFitnessPlusCatalogResponse(catalogResponse);
    expect(
      createFitnessPlusPurchasePayload({
        catalog,
        planCode: "fitness_plus_smart",
        billingCycle: "month",
        requestId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toEqual({
      planCode: "fitness_plus_smart",
      billingCycle: "month",
      requestId: "11111111-1111-4111-8111-111111111111",
      expectedAmount: 199000,
      catalogFingerprint: "a".repeat(64),
      protocolVersion: 1,
    });
  });

  it("fails closed when localized catalog copy is empty", () => {
    const response = structuredClone(catalogResponse);
    response.data.data[0].subtitle = "   ";

    expect(() => normalizeFitnessPlusCatalogResponse(response)).toThrow(
      "HT Fitness+ catalog response is incomplete",
    );
  });
});
