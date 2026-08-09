const policySignature = (policy) =>
  JSON.stringify({
    mode: policy?.mode,
    limit: policy?.limit,
    unitLabel: policy?.unitLabel,
    period: policy?.period,
    periodLabel: policy?.periodLabel,
    scope: policy?.scope,
    scopeLabel: policy?.scopeLabel,
    enforcement: policy?.enforcement,
  });

export const formatPolicy = (policy) => {
  if (!policy || policy.mode === "unavailable") {
    return { primary: "Chưa khả dụng", secondary: "" };
  }
  if (policy.mode === "unlimited") {
    return { primary: "Không giới hạn", secondary: "" };
  }

  return {
    primary: `${policy.limit} ${policy.unitLabel} / ${policy.periodLabel}`,
    secondary: policy.scopeLabel ? `Theo ${policy.scopeLabel}` : "",
  };
};

export const groupColumnPolicies = (service, column) => {
  const groups = new Map();
  for (const tier of column.tiers || []) {
    const policy = service.policies?.[tier.key];
    if (!policy) continue;
    const signature = policySignature(policy);
    const current = groups.get(signature);
    if (current) current.labels.push(tier.label);
    else groups.set(signature, { labels: [tier.label], policy });
  }
  return [...groups.values()];
};

export const enforcementLabel = (enforcement) =>
  ({
    server_rate_limit: "Rate limit server",
    server_counter: "Bộ đếm tài khoản",
    client_session: "Giới hạn theo phiên",
    none: "Không giới hạn",
  })[enforcement] || enforcement;

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export const formatTrainerPlanPrice = (plan) => {
  if (plan?.prices?.trial === 0) {
    return `Miễn phí · ${plan.durationDays} ngày`;
  }
  if (!Number.isFinite(plan?.prices?.month) || !Number.isFinite(plan?.prices?.year)) {
    return "—";
  }
  return `${currencyFormatter.format(plan.prices.month)}/tháng · ${currencyFormatter.format(plan.prices.year)}/năm`;
};

export const formatTrainerBenefitValue = (value, benefit) => {
  if (benefit?.valueType === "capacity" && Number.isFinite(value)) {
    return `${value} học viên`;
  }
  return value === true ? "Có" : "Không";
};
