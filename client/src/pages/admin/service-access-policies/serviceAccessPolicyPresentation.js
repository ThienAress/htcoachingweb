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

export const getCommunityFeatureGroups = (features = []) => {
  const groups = new Map();
  for (const feature of Array.isArray(features) ? features : []) {
    const group = feature?.group;
    if (group?.key && group?.label && !groups.has(group.key)) {
      groups.set(group.key, group);
    }
  }
  return [...groups.values()];
};

export const filterCommunityFeaturesByGroup = (
  features = [],
  selectedGroup = "all",
) => {
  const items = Array.isArray(features) ? features : [];
  if (!selectedGroup || selectedGroup === "all") return items;
  return items.filter((feature) => feature?.group?.key === selectedGroup);
};

const COMMUNITY_FEATURE_PRIORITY_TONES = Object.freeze({
  F0: "critical",
  F1: "high",
  F2: "planned",
  F3: "later",
});

export const getCommunityFeaturePriorityMeta = (priority) => {
  const tone = COMMUNITY_FEATURE_PRIORITY_TONES[priority?.code];
  if (!tone) {
    return { code: "—", label: "Chưa xếp ưu tiên", tone: "unranked" };
  }
  return {
    code: priority.code,
    label: priority.label || priority.code,
    tone,
  };
};

const COMMUNITY_FEATURE_DELIVERY_TONES = Object.freeze({
  in_progress: "in_progress",
  implemented: "implemented",
  verified: "verified",
  production_verified: "production_verified",
});

const COMMUNITY_FEATURE_DATE_FORMATTER = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

const parseDateOnly = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!match) return null;
  const [, year, month, day] = match;
  const candidate = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day)),
  );
  if (candidate.toISOString().slice(0, 10) !== value) return null;
  return candidate;
};

const formatDateOnly = (value) => {
  const candidate = parseDateOnly(value);
  return candidate ? COMMUNITY_FEATURE_DATE_FORMATTER.format(candidate) : null;
};

export const formatCommunityFeatureDate = (value) =>
  formatDateOnly(value) || "—";

export const getCommunityFeatureHistoryRecords = (feature) => {
  if (Array.isArray(feature?.improvementHistory)) {
    return feature.improvementHistory;
  }
  if (!Array.isArray(feature?.deliveryUpdates)) return [];
  return feature.deliveryUpdates.map((update) => ({
    improvementKey: update.updateKey,
    opportunity: update.label,
    result: update.result || update.label,
    milestones: [
      {
        status: update.status,
        statusDate: update.statusDate,
      },
    ],
  }));
};

export const getCommunityFeatureLatestMilestone = (record) => {
  const milestones = Array.isArray(record?.milestones)
    ? record.milestones
    : [];
  return milestones.at(-1) || null;
};

export const getCommunityFeatureHistoryDateRange = (features = []) => {
  const dates = (Array.isArray(features) ? features : [])
    .flatMap((feature) => getCommunityFeatureHistoryRecords(feature))
    .flatMap((record) =>
      Array.isArray(record?.milestones) ? record.milestones : [],
    )
    .map((milestone) => milestone?.statusDate)
    .filter((date) => parseDateOnly(date))
    .sort();
  return {
    from: dates[0] || "",
    to: dates.at(-1) || "",
  };
};

export const getCommunityFeatureDeliveryMeta = (deliveryUpdate) => {
  const code = deliveryUpdate?.status?.code;
  const tone = Object.hasOwn(COMMUNITY_FEATURE_DELIVERY_TONES, code)
    ? COMMUNITY_FEATURE_DELIVERY_TONES[code]
    : null;
  const label = String(deliveryUpdate?.status?.label || "").trim();
  const dateLabel = formatDateOnly(deliveryUpdate?.statusDate);
  if (!tone || !label || !dateLabel) {
    return {
      code: "unknown",
      label: "Chưa xác định",
      dateLabel: "—",
      tone: "unknown",
    };
  }
  return {
    code,
    label,
    dateLabel,
    tone,
  };
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
