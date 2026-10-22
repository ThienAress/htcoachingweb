import { describe, expect, it } from "vitest";

import { getTrainerPlanAmount } from "../trainerPlanCatalog.service.js";
import { resolveTrainerPurchasePricing } from "../trainerPurchasePricing.js";

const DAY = 24 * 60 * 60 * 1000;
const startDate = new Date("2026-10-01T00:00:00.000Z");
const endDate = new Date(startDate.getTime() + 30 * DAY);
const now = new Date(startDate.getTime() + 15 * DAY);

const monthlyProfessional = (source) => ({
  source,
  billingCycle: "month",
  amount: getTrainerPlanAmount("professional", "month"),
  startDate,
  endDate,
});

const upgrade = (active) =>
  resolveTrainerPurchasePricing({
    active,
    activePlan: { code: "professional" },
    plan: { code: "premium" },
    billingCycle: "year",
    now,
  });

describe("resolveTrainerPurchasePricing: gói do admin tạo sau khi HLV chuyển khoản riêng", () => {
  it("báo giá nâng cấp lên gói năm giống hệt gói HLV tự mua", () => {
    const selfPurchase = upgrade(monthlyProfessional("self_purchase"));
    const adminGrant = upgrade(monthlyProfessional("admin_grant"));
    const pendingGrant = upgrade(monthlyProfessional("pending_grant"));

    expect(selfPurchase.action).toBe("upgrade_to_year");
    expect(selfPurchase.creditAmount).toBeGreaterThan(0);
    expect(adminGrant).toEqual(selfPurchase);
    expect(pendingGrant).toEqual(selfPurchase);
  });

  it("vẫn chặn gói thấp hơn và đổi gói khi đang dùng gói năm, kể cả gói admin tạo", () => {
    const yearly = { ...monthlyProfessional("admin_grant"), billingCycle: "year" };
    expect(() =>
      resolveTrainerPurchasePricing({
        active: yearly,
        activePlan: { code: "professional" },
        plan: { code: "premium" },
        billingCycle: "year",
        now,
      }),
    ).toThrow(/gói năm/);
    expect(() =>
      resolveTrainerPurchasePricing({
        active: monthlyProfessional("admin_grant"),
        activePlan: { code: "professional" },
        plan: { code: "standard" },
        billingCycle: "year",
        now,
      }),
    ).toThrow(/nâng cấp lên gói năm/);
  });
});
