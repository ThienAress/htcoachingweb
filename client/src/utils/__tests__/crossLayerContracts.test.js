import { describe, expect, it } from "vitest";

import {
  buildTrainerPlanOffers,
  createTrainerPlanPurchasePayload,
  normalizeTrainerPlanCatalogResponse,
} from "../trainerPlanCatalog";
import { deriveMealPlanAccess } from "../mealPlanAccess";
import { ORDER_STATUS_META } from "../../constants/orderStatus";
import { CONTRACT_STATUS_META } from "../../constants/contractStatus";
import {
  F1_CUSTOMER_STATUS_LABELS,
  getF1Progress,
} from "../../constants/f1CustomerStatus";

const catalogResponse = {
  data: {
    data: [
      {
        code: "free",
        title: "Free",
        prices: { trial: 0 },
        billingCycles: ["trial"],
        durationDays: 30,
        maxClients: 3,
        entitlements: { f1CrmAi: false },
      },
      {
        code: "standard",
        title: "Tiêu chuẩn",
        prices: { month: 200000, year: 2000000 },
        billingCycles: ["month", "year"],
        durationDays: null,
        maxClients: 5,
        entitlements: { f1CrmAi: false },
      },
      {
        code: "professional",
        title: "Chuyên nghiệp",
        prices: { month: 250000, year: 2500000 },
        billingCycles: ["month", "year"],
        durationDays: null,
        maxClients: 20,
        entitlements: { f1CrmAi: true },
      },
      {
        code: "premium",
        title: "Cao cấp",
        prices: { month: 300000, year: 3000000 },
        billingCycles: ["month", "year"],
        durationDays: null,
        maxClients: 50,
        entitlements: { f1CrmAi: true },
      },
    ],
    meta: {
      currency: "VND",
      catalogFingerprint: "a".repeat(64),
      protocolVersion: 1,
    },
  },
};

describe("cross-layer client contracts", () => {
  it("builds checkout and SEO values from the same catalog response", () => {
    const catalog = normalizeTrainerPlanCatalogResponse(catalogResponse);
    expect(catalog.byCode.standard.prices.month).toBe(200000);
    expect(buildTrainerPlanOffers(catalog)).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "Free - 30 ngày", price: 0 }),
      expect.objectContaining({ name: "Tiêu chuẩn - theo tháng", price: 200000 }),
      expect.objectContaining({ name: "Tiêu chuẩn - theo năm", price: 2000000 }),
      expect.objectContaining({ name: "Chuyên nghiệp - theo tháng", price: 250000 }),
      expect.objectContaining({ name: "Cao cấp - theo năm", price: 3000000 }),
    ]));
    expect(buildTrainerPlanOffers(catalog)).toHaveLength(7);
    expect(
      createTrainerPlanPurchasePayload({
        catalog,
        planCode: "standard",
        billingCycle: "month",
        requestId: "request-id",
      }),
    ).toEqual({
      planCode: "standard",
      billingCycle: "month",
      requestId: "request-id",
      expectedAmount: 200000,
      catalogFingerprint: "a".repeat(64),
      protocolVersion: 1,
    });
  });

  it("rejects incomplete or malformed catalogs before rendering checkout", () => {
    const incomplete = structuredClone(catalogResponse);
    incomplete.data.data.pop();
    expect(() => normalizeTrainerPlanCatalogResponse(incomplete)).toThrow(
      "incomplete",
    );

    const malformed = structuredClone(catalogResponse);
    malformed.data.data[1].prices.month = "200000";
    expect(() => normalizeTrainerPlanCatalogResponse(malformed)).toThrow(
      "incomplete",
    );
  });

  it("fails meal-plan access closed until server policy is known", () => {
    expect(deriveMealPlanAccess(null)).toEqual({
      canGenerate: false,
      remainingGenerations: 0,
    });
    expect(
      deriveMealPlanAccess({
        accessLevel: "trial",
        generationCount: 0,
        maxGenerations: 1,
      }),
    ).toEqual({ canGenerate: true, remainingGenerations: 1 });
  });

  it("covers every active status exposed by backend models", () => {
    expect(Object.keys(ORDER_STATUS_META)).toEqual([
      "pending",
      "approved",
      "completed",
      "cancelled",
    ]);
    expect(Object.keys(CONTRACT_STATUS_META)).toContain("signing");
    expect(F1_CUSTOMER_STATUS_LABELS).toHaveProperty("program_started");
    expect(F1_CUSTOMER_STATUS_LABELS).not.toHaveProperty("testing_completed");
    expect(getF1Progress("program_started")).toEqual({
      intakeDone: true,
      assessmentDone: true,
      reportDone: true,
    });
  });
});
