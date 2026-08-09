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
