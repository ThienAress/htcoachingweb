import { describe, expect, it } from "vitest";

import {
  applyUpgradeCredit,
  computeUnusedPeriodCredit,
  isMonthToYearUpgrade,
} from "../planUpgradePricing.js";

const DAY = 24 * 60 * 60 * 1000;
const start = new Date("2026-10-01T00:00:00.000Z");
const end = new Date(start.getTime() + 30 * DAY);

describe("computeUnusedPeriodCredit", () => {
  it("dùng 15/30 ngày gói 99.000đ: còn 15 ngày, tín dụng 49.500đ", () => {
    const now = new Date(start.getTime() + 15 * DAY);
    expect(computeUnusedPeriodCredit({ paidAmount: 99000, startDate: start, endDate: end, now })).toEqual({
      creditAmount: 49500,
      remainingDays: 15,
      periodDays: 30,
    });
  });

  it("ngày còn dở được tính là một ngày", () => {
    const now = new Date(start.getTime() + 15 * DAY + 60 * 60 * 1000);
    expect(
      computeUnusedPeriodCredit({ paidAmount: 99000, startDate: start, endDate: end, now }).remainingDays,
    ).toBe(15);
  });

  it("vừa mua xong: tín dụng bằng đúng số đã trả, không vượt", () => {
    const result = computeUnusedPeriodCredit({ paidAmount: 99000, startDate: start, endDate: end, now: start });
    expect(result).toEqual({ creditAmount: 99000, remainingDays: 30, periodDays: 30 });
  });

  it("hết hạn hoặc quá hạn: không có tín dụng", () => {
    expect(computeUnusedPeriodCredit({ paidAmount: 99000, startDate: start, endDate: end, now: end }).creditAmount).toBe(0);
    expect(
      computeUnusedPeriodCredit({ paidAmount: 99000, startDate: start, endDate: end, now: new Date(end.getTime() + DAY) })
        .creditAmount,
    ).toBe(0);
  });

  it("gói tặng hoặc gói 0 đồng không tạo tín dụng", () => {
    expect(computeUnusedPeriodCredit({ paidAmount: 0, startDate: start, endDate: end, now: start }).creditAmount).toBe(0);
    expect(computeUnusedPeriodCredit({ paidAmount: null, startDate: start, endDate: end, now: start }).creditAmount).toBe(0);
  });

  it("làm tròn xuống 100 đồng: gói 199.000đ còn 7/30 ngày là 46.400đ", () => {
    const now = new Date(start.getTime() + 23 * DAY);
    // 199000 x 7 / 30 = 46433,33 -> 46400
    expect(computeUnusedPeriodCredit({ paidAmount: 199000, startDate: start, endDate: end, now }).creditAmount).toBe(46400);
  });

  it("dữ liệu ngày sai thì không có tín dụng", () => {
    expect(computeUnusedPeriodCredit({ paidAmount: 99000, startDate: end, endDate: start }).creditAmount).toBe(0);
    expect(computeUnusedPeriodCredit({ paidAmount: 99000, startDate: "x", endDate: "y" }).creditAmount).toBe(0);
  });
});

describe("applyUpgradeCredit và isMonthToYearUpgrade", () => {
  it("trả giá năm trừ tín dụng, luôn dương và không vượt giá niêm yết", () => {
    expect(applyUpgradeCredit(990000, 49500)).toBe(940500);
    expect(applyUpgradeCredit(990000, 0)).toBe(990000);
    expect(applyUpgradeCredit(990000, 5000000)).toBe(1);
  });

  it("chỉ nhận ra nâng cấp từ gói tháng lên gói năm", () => {
    expect(isMonthToYearUpgrade({ billingCycle: "month" }, "year")).toBe(true);
    expect(isMonthToYearUpgrade({ billingCycle: "year" }, "year")).toBe(false);
    expect(isMonthToYearUpgrade({ billingCycle: "month" }, "month")).toBe(false);
    expect(isMonthToYearUpgrade(null, "year")).toBe(false);
  });
});
