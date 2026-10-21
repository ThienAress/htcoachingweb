// Trạng thái nút mua gói dùng chung cho HT Fitness+ và gói HLV. Phản chiếu luật của server
// (server/src/services/fitnessPlusPurchasePricing.js và trainerPurchasePricing.js); server vẫn là nơi quyết định cuối cùng.

const TRAINER_PAID_TIERS = ["standard", "professional", "premium"];

const BUY = Object.freeze({ kind: "buy", disabled: false, reason: null });
const CURRENT = Object.freeze({ kind: "current", disabled: true, reason: null });
const UPGRADE = Object.freeze({ kind: "upgrade", disabled: false, reason: null });
const blocked = (reason) => Object.freeze({ kind: "blocked", disabled: true, reason });

// current: gói đang dùng { planCode, billingCycle } hoặc null. family: "fitness" | "trainer".
export const getPlanCtaState = ({ family, current, planCode, billingCycle }) => {
  if (!current?.planCode || current.planCode === "free") return BUY;
  const samePlan = current.planCode === planCode;
  if (samePlan && current.billingCycle === billingCycle) return CURRENT;

  if (current.billingCycle === "year") {
    if (family === "trainer") return blocked("has_year");
    // Fitness+: không xuống gói tháng; đổi sang gói năm khác vẫn được như trước.
    return billingCycle === "month" ? blocked("year_to_month") : BUY;
  }

  if (billingCycle === "year") {
    if (family === "fitness") return UPGRADE;
    const currentTier = TRAINER_PAID_TIERS.indexOf(current.planCode);
    const targetTier = TRAINER_PAID_TIERS.indexOf(planCode);
    return currentTier !== -1 && targetTier >= currentTier ? UPGRADE : blocked("has_plan");
  }

  // Gói tháng sang gói khác cùng chu kỳ tháng: Fitness+ giữ cách cũ, gói HLV không cho.
  return family === "fitness" ? BUY : blocked("has_plan");
};

export const PLAN_STATE_HINT_KEYS = Object.freeze({
  year_to_month: "pricing.plan_hint_year_to_month",
  has_year: "pricing.plan_hint_has_year",
  has_plan: "pricing.plan_hint_has_plan",
});

export const PLAN_STATE_LABEL_KEYS = Object.freeze({
  current: "pricing.current_plan",
  upgrade: "pricing.upgrade_to_year",
  blocked: "pricing.plan_unavailable",
});
