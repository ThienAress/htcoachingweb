import { describe, expect, it } from "vitest";

import { buildPlanDisplay, getPlanIcon } from "../planBadges";
import { getPlanCtaState } from "../planStatus";

const state = (family, current, planCode, billingCycle) =>
  getPlanCtaState({ family, current, planCode, billingCycle });

describe("getPlanCtaState: HT Fitness+", () => {
  const monthEssential = { planCode: "fitness_plus_essential", billingCycle: "month" };
  const yearEssential = { planCode: "fitness_plus_essential", billingCycle: "year" };

  it("chưa có gói thì được mua", () => {
    expect(state("fitness", null, "fitness_plus_smart", "month").kind).toBe("buy");
  });

  it("đúng gói và đúng chu kỳ đang dùng thì khóa nút 'đang sử dụng'", () => {
    expect(state("fitness", monthEssential, "fitness_plus_essential", "month")).toMatchObject({ kind: "current", disabled: true });
    expect(state("fitness", yearEssential, "fitness_plus_essential", "year")).toMatchObject({ kind: "current", disabled: true });
  });

  it("đang dùng gói tháng thì mở nâng cấp lên gói năm, kể cả cùng gói", () => {
    expect(state("fitness", monthEssential, "fitness_plus_essential", "year")).toMatchObject({ kind: "upgrade", disabled: false });
    expect(state("fitness", monthEssential, "fitness_plus_max", "year")).toMatchObject({ kind: "upgrade", disabled: false });
  });

  it("đang dùng gói năm thì chặn chuyển về gói tháng, kèm lý do", () => {
    expect(state("fitness", yearEssential, "fitness_plus_essential", "month")).toMatchObject({ kind: "blocked", reason: "year_to_month" });
    expect(state("fitness", yearEssential, "fitness_plus_smart", "month")).toMatchObject({ kind: "blocked", reason: "year_to_month" });
  });

  it("đổi sang gói khác cùng chu kỳ vẫn được như trước", () => {
    expect(state("fitness", monthEssential, "fitness_plus_smart", "month")).toMatchObject({ kind: "buy", disabled: false });
    expect(state("fitness", yearEssential, "fitness_plus_smart", "year")).toMatchObject({ kind: "buy", disabled: false });
  });
});

describe("getPlanCtaState: gói HLV", () => {
  const monthPro = { planCode: "professional", billingCycle: "month" };
  const yearPro = { planCode: "professional", billingCycle: "year" };

  it("gói Free hoặc chưa có gói thì được mua gói trả phí", () => {
    expect(state("trainer", null, "standard", "month").kind).toBe("buy");
    expect(state("trainer", { planCode: "free", billingCycle: "trial" }, "premium", "year").kind).toBe("buy");
  });

  it("đúng gói đang dùng thì khóa; cùng gói lên năm hoặc gói cao hơn lên năm thì mở nâng cấp", () => {
    expect(state("trainer", monthPro, "professional", "month").kind).toBe("current");
    expect(state("trainer", monthPro, "professional", "year").kind).toBe("upgrade");
    expect(state("trainer", monthPro, "premium", "year").kind).toBe("upgrade");
  });

  it("gói thấp hơn, gói tháng khác hoặc đang dùng gói năm thì bị chặn", () => {
    expect(state("trainer", monthPro, "standard", "year")).toMatchObject({ kind: "blocked", reason: "has_plan" });
    expect(state("trainer", monthPro, "premium", "month")).toMatchObject({ kind: "blocked", reason: "has_plan" });
    expect(state("trainer", yearPro, "premium", "year")).toMatchObject({ kind: "blocked", reason: "has_year" });
    expect(state("trainer", yearPro, "professional", "month")).toMatchObject({ kind: "blocked", reason: "has_year" });
  });
});

describe("planBadges", () => {
  it("cùng một bộ biểu tượng cho gói HLV và HT Fitness+ theo planCode", () => {
    expect(getPlanIcon("standard")).toBe("🔥");
    expect(getPlanIcon("fitness_plus_essential")).toBe("🔥");
    expect(getPlanIcon("professional")).toBe("💎");
    expect(getPlanIcon("fitness_plus_smart")).toBe("💎");
    expect(getPlanIcon("premium")).toBe("👑");
    expect(getPlanIcon("fitness_plus_max")).toBe("👑");
    expect(getPlanIcon("khong_co")).toBe("");
  });

  it("gói HLV hiển thị trước; không có thì HT Fitness+ kèm tên gói", () => {
    expect(
      buildPlanDisplay({
        trainerSubscription: { planCode: "professional", planTitle: "Chuyên nghiệp" },
        fitnessSubscription: { planCode: "fitness_plus_max", planTitle: "Toàn diện" },
      }),
    ).toMatchObject({ kind: "trainer", label: "Chuyên nghiệp", icon: "💎" });
    expect(buildPlanDisplay({ fitnessSubscription: { planCode: "fitness_plus_smart", planTitle: "Tăng tốc" } })).toMatchObject({
      kind: "fitness",
      label: "HT Fitness+ Tăng tốc",
      icon: "💎",
    });
    expect(buildPlanDisplay({})).toBeNull();
  });

  it("dữ liệu HLV cũ chỉ có tên gói vẫn ra đúng biểu tượng", () => {
    expect(buildPlanDisplay({ trainerSubscription: { planTitle: "Cao cấp" } }).icon).toBe("👑");
  });
});
