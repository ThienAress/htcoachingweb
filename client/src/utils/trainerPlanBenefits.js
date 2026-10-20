export const buildTrainerPlanCategories = ({ plan, benefits, t }) => {
  if (!plan || !Array.isArray(benefits)) return [];

  const categories = new Map();
  for (const benefit of benefits) {
    if (!benefit.includedPlanCodes?.includes(plan.code)) continue;

    const categoryKey = benefit.category.key;
    const categoryIcon =
      ({ crm_ai: "✨", privilege: "👑" })[categoryKey] || null;
    const category = categories.get(categoryKey) || {
      key: categoryKey,
      name: t(`pricing.trainer_plans.categories.${categoryKey}`),
      ...(categoryIcon ? { icon: categoryIcon } : {}),
      features: [],
    };
    const translationKey = `pricing.trainer_plans.features.${benefit.key}`;
    category.features.push(
      benefit.valueType === "capacity"
        ? t(translationKey, { count: plan.maxClients })
        : t(translationKey),
    );
    categories.set(categoryKey, category);
  }

  return [...categories.values()];
};

// Tách quyền lợi: nhóm chung cho mọi gói (nêu một lần), phần riêng của từng gói, còn sức chứa học viên
// (valueType "capacity") để thẻ hiển thị thành con số lớn.
export const splitTrainerPlanBenefits = ({ plans, benefits, t }) => {
  const empty = { shared: [], perPlan: {} };
  if (!Array.isArray(plans) || plans.length === 0 || !Array.isArray(benefits)) return empty;

  const codes = plans.map((plan) => plan.code);
  const sharedCategories = new Map();
  const perPlan = Object.fromEntries(codes.map((code) => [code, new Map()]));

  const push = (map, benefit) => {
    const categoryKey = benefit.category.key;
    const categoryIcon = ({ crm_ai: "✨", privilege: "👑" })[categoryKey] || null;
    const category = map.get(categoryKey) || {
      key: categoryKey,
      name: t(`pricing.trainer_plans.categories.${categoryKey}`),
      ...(categoryIcon ? { icon: categoryIcon } : {}),
      features: [],
    };
    category.features.push(t(`pricing.trainer_plans.features.${benefit.key}`));
    map.set(categoryKey, category);
  };

  for (const benefit of benefits) {
    if (benefit.valueType === "capacity") continue;
    const included = codes.filter((code) => benefit.includedPlanCodes?.includes(code));
    if (included.length === 0) continue;
    if (included.length === codes.length) {
      push(sharedCategories, benefit);
    } else {
      for (const code of included) push(perPlan[code], benefit);
    }
  }

  return {
    shared: [...sharedCategories.values()],
    perPlan: Object.fromEntries(
      Object.entries(perPlan).map(([code, map]) => [code, [...map.values()]]),
    ),
  };
};
