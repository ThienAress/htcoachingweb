const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const THIRTY_DAYS_MS = 30 * DAY_MS;

export const SERVICE_ACCESS_TIERS = Object.freeze({
  GUEST: "guest",
  USER: "user",
  COACHING_CUSTOMER: "coaching_customer",
  TRAINER: "trainer",
  FITNESS_PLUS_ESSENTIAL: "fitness_plus_essential",
  FITNESS_PLUS_SMART: "fitness_plus_smart",
  FITNESS_PLUS_MAX: "fitness_plus_max",
});

export const SERVICE_ACCESS_POLICY_VERSION = "2026-08-18.2";

const quotaWindow = ({ key, limit, period, periodLabel, windowMs = null }) => ({
  key,
  limit,
  period,
  periodLabel,
  windowMs,
});

const quota = ({
  limit,
  unitLabel,
  period,
  periodLabel,
  scope,
  scopeLabel,
  enforcement,
  windowMs = null,
  windows = null,
}) => {
  const normalizedWindows =
    windows || [quotaWindow({ key: period, limit, period, periodLabel, windowMs })];
  const primary = normalizedWindows[0];
  return {
    mode: "quota",
    // Compatibility fields remain the primary/shortest policy window.
    limit: primary.limit,
    unitLabel,
    period: primary.period,
    periodLabel: primary.periodLabel,
    scope,
    scopeLabel,
    enforcement,
    windowMs: primary.windowMs,
    windows: normalizedWindows,
  };
};

const unlimited = () => ({
  mode: "unlimited",
  limit: null,
  unitLabel: null,
  period: null,
  periodLabel: null,
  scope: null,
  scopeLabel: null,
  enforcement: "none",
  windowMs: null,
  windows: [],
});

const deepFreeze = (value) => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};
export const SERVICE_ACCESS_POLICY_REGISTRY = deepFreeze([
  {
    serviceKey: "meal_scan",
    label: "Meal Scan",
    category: "AI dinh dưỡng",
    description: "Phân tích ảnh món ăn và ước tính calo, macro.",
    policies: {
      guest: quota({
        limit: 1,
        unitLabel: "lượt",
        period: "lifetime",
        periodLabel: "lifetime",
        scope: "browser",
        scopeLabel: "trình duyệt",
        enforcement: "shared_usage_ledger",
      }),
      user: quota({
        limit: 1,
        unitLabel: "lượt",
        period: "lifetime",
        periodLabel: "lifetime",
        scope: "user",
        scopeLabel: "tài khoản",
        enforcement: "shared_usage_ledger",
      }),
      coaching_customer: quota({
        unitLabel: "lượt",
        scope: "user",
        scopeLabel: "user",
        enforcement: "shared_usage_ledger",
        windows: [
          quotaWindow({ key: "daily", limit: 10, period: "rolling_day", periodLabel: "ngày", windowMs: DAY_MS }),
          quotaWindow({ key: "monthly", limit: 300, period: "rolling_30_days", periodLabel: "30 ngày", windowMs: THIRTY_DAYS_MS }),
        ],
      }),
      trainer: quota({
        unitLabel: "lượt",
        scope: "user",
        scopeLabel: "user",
        enforcement: "shared_usage_ledger",
        windows: [
          quotaWindow({ key: "daily", limit: 20, period: "rolling_day", periodLabel: "ngày", windowMs: DAY_MS }),
          quotaWindow({ key: "monthly", limit: 600, period: "rolling_30_days", periodLabel: "30 ngày", windowMs: THIRTY_DAYS_MS }),
        ],
      }),
      fitness_plus_essential: quota({
        unitLabel: "lượt",
        scope: "user",
        scopeLabel: "user",
        enforcement: "shared_usage_ledger",
        windows: [
          quotaWindow({ key: "daily", limit: 5, period: "rolling_day", periodLabel: "ngày", windowMs: DAY_MS }),
          quotaWindow({ key: "monthly", limit: 120, period: "rolling_30_days", periodLabel: "30 ngày", windowMs: THIRTY_DAYS_MS }),
        ],
      }),
      fitness_plus_smart: quota({
        unitLabel: "lượt",
        scope: "user",
        scopeLabel: "user",
        enforcement: "shared_usage_ledger",
        windows: [
          quotaWindow({ key: "daily", limit: 10, period: "rolling_day", periodLabel: "ngày", windowMs: DAY_MS }),
          quotaWindow({ key: "monthly", limit: 210, period: "rolling_30_days", periodLabel: "30 ngày", windowMs: THIRTY_DAYS_MS }),
        ],
      }),
      fitness_plus_max: quota({
        unitLabel: "lượt",
        scope: "user",
        scopeLabel: "user",
        enforcement: "shared_usage_ledger",
        windows: [
          quotaWindow({ key: "daily", limit: 15, period: "rolling_day", periodLabel: "ngày", windowMs: DAY_MS }),
          quotaWindow({ key: "monthly", limit: 300, period: "rolling_30_days", periodLabel: "30 ngày", windowMs: THIRTY_DAYS_MS }),
        ],
      }),
    },
  },
  {
    serviceKey: "ai_chat",
    label: "AI Chat",
    category: "AI hỗ trợ",
    description: "HT Assistant theo ngữ cảnh trang và dữ liệu được phép truy cập.",
    policies: {
      guest: quota({
        limit: 5,
        unitLabel: "tin",
        period: "rolling_24_hours",
        periodLabel: "24 giờ",
        scope: "ip",
        scopeLabel: "IP",
        enforcement: "shared_usage_ledger",
        windowMs: DAY_MS,
      }),
      user: quota({
        unitLabel: "tin",
        scope: "user",
        scopeLabel: "user",
        enforcement: "shared_usage_ledger",
        windows: [
          quotaWindow({ key: "daily", limit: 15, period: "rolling_24_hours", periodLabel: "24 giờ", windowMs: DAY_MS }),
          quotaWindow({ key: "monthly", limit: 60, period: "rolling_30_days", periodLabel: "30 ngày", windowMs: THIRTY_DAYS_MS }),
        ],
      }),
      coaching_customer: quota({
        unitLabel: "tin",
        scope: "user",
        scopeLabel: "user",
        enforcement: "shared_usage_ledger",
        windows: [
          quotaWindow({ key: "burst", limit: 30, period: "rolling_hour", periodLabel: "giờ", windowMs: HOUR_MS }),
          quotaWindow({ key: "monthly", limit: 600, period: "rolling_30_days", periodLabel: "30 ngày", windowMs: THIRTY_DAYS_MS }),
        ],
      }),
      trainer: quota({
        unitLabel: "tin",
        scope: "user",
        scopeLabel: "user",
        enforcement: "shared_usage_ledger",
        windows: [
          quotaWindow({ key: "burst", limit: 30, period: "rolling_hour", periodLabel: "giờ", windowMs: HOUR_MS }),
          quotaWindow({ key: "monthly", limit: 1200, period: "rolling_30_days", periodLabel: "30 ngày", windowMs: THIRTY_DAYS_MS }),
        ],
      }),
      fitness_plus_essential: quota({
        unitLabel: "tin",
        scope: "user",
        scopeLabel: "user",
        enforcement: "shared_usage_ledger",
        windows: [
          quotaWindow({ key: "burst", limit: 20, period: "rolling_hour", periodLabel: "giờ", windowMs: HOUR_MS }),
          quotaWindow({ key: "monthly", limit: 120, period: "rolling_30_days", periodLabel: "30 ngày", windowMs: THIRTY_DAYS_MS }),
        ],
      }),
      fitness_plus_smart: quota({
        unitLabel: "tin",
        scope: "user",
        scopeLabel: "user",
        enforcement: "shared_usage_ledger",
        windows: [
          quotaWindow({ key: "burst", limit: 40, period: "rolling_hour", periodLabel: "giờ", windowMs: HOUR_MS }),
          quotaWindow({ key: "monthly", limit: 300, period: "rolling_30_days", periodLabel: "30 ngày", windowMs: THIRTY_DAYS_MS }),
        ],
      }),
      fitness_plus_max: quota({
        unitLabel: "tin",
        scope: "user",
        scopeLabel: "user",
        enforcement: "shared_usage_ledger",
        windows: [
          quotaWindow({ key: "burst", limit: 60, period: "rolling_hour", periodLabel: "giờ", windowMs: HOUR_MS }),
          quotaWindow({ key: "monthly", limit: 600, period: "rolling_30_days", periodLabel: "30 ngày", windowMs: THIRTY_DAYS_MS }),
        ],
      }),
    },
  },
  {
    serviceKey: "meal_plan",
    label: "Meal Plan",
    category: "Dinh dưỡng",
    description: "Gợi ý thực đơn theo mục tiêu calo và macro.",
    policies: {
      guest: quota({
        limit: 1,
        unitLabel: "preview",
        period: "session",
        periodLabel: "phiên",
        scope: "session",
        scopeLabel: "session",
        enforcement: "client_session",
      }),
      user: quota({
        limit: 1,
        unitLabel: "lượt",
        period: "lifetime",
        periodLabel: "lifetime",
        scope: "user",
        scopeLabel: "tài khoản",
        enforcement: "server_counter",
      }),
      coaching_customer: unlimited(),
      trainer: unlimited(),
      fitness_plus_essential: unlimited(),
      fitness_plus_smart: unlimited(),
      fitness_plus_max: unlimited(),
    },
  },
  {
    serviceKey: "tdee",
    label: "TDEE",
    category: "Công cụ",
    description: "Tính nhu cầu năng lượng và macro mục tiêu.",
    policies: {
      guest: unlimited(),
      user: unlimited(),
      coaching_customer: unlimited(),
      trainer: unlimited(),
      fitness_plus_essential: unlimited(),
      fitness_plus_smart: unlimited(),
      fitness_plus_max: unlimited(),
    },
  },
]);

const registryByKey = new Map(
  SERVICE_ACCESS_POLICY_REGISTRY.map((service) => [
    service.serviceKey,
    service,
  ]),
);

export const getServiceAccessPolicy = (serviceKey, tier) => {
  const service = registryByKey.get(serviceKey);
  if (!service) throw new Error(`Unknown service access policy: ${serviceKey}`);
  const policy = service.policies[tier];
  if (!policy) throw new Error(`Unknown service access tier: ${tier}`);
  return policy;
};

export const getServicePolicyWindows = (policy) => {
  if (policy?.mode !== "quota") return [];
  if (Array.isArray(policy.windows) && policy.windows.length > 0) {
    return policy.windows;
  }
  return [
    {
      key: policy.period,
      limit: policy.limit,
      period: policy.period,
      periodLabel: policy.periodLabel,
      windowMs: policy.windowMs ?? null,
    },
  ];
};

export const createServiceEntitlementSnapshot = (tier) => {
  if (!Object.values(SERVICE_ACCESS_TIERS).includes(tier)) {
    throw new Error(`Unknown service access tier: ${tier}`);
  }
  return Object.fromEntries(
    SERVICE_ACCESS_POLICY_REGISTRY.map(({ serviceKey, policies }) => [
      serviceKey,
      JSON.parse(JSON.stringify(policies[tier])),
    ]),
  );
};
