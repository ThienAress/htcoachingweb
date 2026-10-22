import { getTrainerPlanAmount } from "./trainerPlanCatalog.service.js";
import {
  applyUpgradeCredit,
  computeUnusedPeriodCredit,
  isMonthToYearUpgrade,
} from "./planUpgradePricing.js";

const PAID_TIER_ORDER = Object.freeze(["standard", "professional", "premium"]);

const failure = (message) =>
  Object.assign(new Error(message), { status: 409, code: "ACTIVE_SUBSCRIPTION_EXISTS", expose: true });

// Quy tắc mua gói HLV (server là nguồn sự thật):
// - chưa có gói: mua theo giá niêm yết;
// - đang dùng gói Free: mua gói trả phí thì thay thế Free (như cũ);
// - đang dùng gói tháng trả phí: chỉ được nâng cấp lên gói năm của cùng gói hoặc gói cao hơn, trừ phần tháng chưa dùng;
// - mọi trường hợp khác khi đang có gói còn hiệu lực đều bị chặn.
export const resolveTrainerPurchasePricing = ({ active, activePlan, plan, billingCycle, now = new Date() }) => {
  const listAmount = getTrainerPlanAmount(plan.code, billingCycle);
  const base = { listAmount, creditAmount: 0, remainingDays: 0, periodDays: 0 };
  if (!active) return { ...base, action: "new", amount: listAmount };

  if (activePlan?.code === "free" && plan.code !== "free") {
    return { ...base, action: "from_free", amount: listAmount };
  }

  const activeRank = PAID_TIER_ORDER.indexOf(activePlan?.code);
  const targetRank = PAID_TIER_ORDER.indexOf(plan.code);
  if (activeRank !== -1 && targetRank >= activeRank && targetRank !== -1 && isMonthToYearUpgrade(active, billingCycle)) {
    const credit = computeUnusedPeriodCredit({
      paidAmount: active.amount,
      startDate: active.startDate,
      endDate: active.endDate,
      now,
    });
    return {
      ...base,
      ...credit,
      action: "upgrade_to_year",
      amount: applyUpgradeCredit(listAmount, credit.creditAmount),
    };
  }

  if (activePlan?.code === plan.code && active.billingCycle === billingCycle) {
    throw failure("Bạn đang sử dụng gói này");
  }
  if (active.billingCycle === "year") {
    throw failure("Bạn đang dùng gói năm còn hiệu lực nên chưa thể đổi gói.");
  }
  throw failure(
    "Bạn đang có gói huấn luyện viên còn hiệu lực. Bạn có thể nâng cấp lên gói năm của cùng gói hoặc gói cao hơn.",
  );
};
