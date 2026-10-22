import { getFitnessPlusPlanAmount } from "./fitnessPlusCatalog.service.js";
import {
  applyUpgradeCredit,
  computeUnusedPeriodCredit,
  isMonthToYearUpgrade,
} from "./planUpgradePricing.js";

const failure = (code, message) => Object.assign(new Error(message), { status: 409, code, expose: true });

// Quy tắc mua/đổi gói HT Fitness+ (server là nguồn sự thật):
// - cùng gói, cùng chu kỳ: đã đang dùng;
// - đang dùng gói năm thì không chuyển xuống gói tháng (sẽ mất phần năm đã trả);
// - gói tháng lên gói năm (cùng gói hoặc gói khác): trả giá năm trừ phần tháng chưa dùng;
// - các đổi gói còn lại giữ cách cũ: giá niêm yết, gói cũ bị thay thế.
export const resolveFitnessPlusPurchasePricing = ({ active, plan, billingCycle, now = new Date() }) => {
  const listAmount = getFitnessPlusPlanAmount(plan.code, billingCycle);
  const base = { listAmount, creditAmount: 0, remainingDays: 0, periodDays: 0 };

  if (!active) return { ...base, action: "new", amount: listAmount };

  if (active.billingCycle === "year" && billingCycle === "month") {
    throw failure(
      "FITNESS_PLUS_DOWNGRADE_NOT_ALLOWED",
      "Bạn đang dùng gói năm nên chưa thể chuyển sang gói tháng. Bạn có thể đổi gói khi gói năm hết hạn.",
    );
  }
  if (active.planCode === plan.code && active.billingCycle === billingCycle) {
    throw failure("FITNESS_PLUS_PLAN_ALREADY_ACTIVE", "Bạn đang sử dụng gói HT Fitness+ này");
  }

  if (isMonthToYearUpgrade(active, billingCycle)) {
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
  return { ...base, action: "switch", amount: listAmount };
};
