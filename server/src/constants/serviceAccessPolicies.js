const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const SERVICE_ACCESS_TIERS = Object.freeze({
  GUEST: "guest",
  USER: "user",
  COACHING_CUSTOMER: "coaching_customer",
  TRAINER: "trainer",
  FITNESS_PLUS_ESSENTIAL: "fitness_plus_essential",
  FITNESS_PLUS_SMART: "fitness_plus_smart",
  FITNESS_PLUS_MAX: "fitness_plus_max",
});

export const SERVICE_ACCESS_POLICY_VERSION = "2026-08-17";

const quota = ({
  limit,
  unitLabel,
  period,
  periodLabel,
  scope,
  scopeLabel,
  enforcement,
  windowMs = null,
}) => ({
  mode: "quota",
  limit,
  unitLabel,
  period,
  periodLabel,
  scope,
  scopeLabel,
  enforcement,
  windowMs,
});

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
        limit: 2,
        unitLabel: "lượt",
        period: "rolling_24_hours",
        periodLabel: "24 giờ",
        scope: "ip",
        scopeLabel: "IP",
        enforcement: "server_rate_limit",
        windowMs: DAY_MS,
      }),
      user: quota({
        limit: 3,
        unitLabel: "lượt",
        period: "rolling_24_hours",
        periodLabel: "24 giờ",
        scope: "user",
        scopeLabel: "user",
        enforcement: "server_rate_limit",
        windowMs: DAY_MS,
      }),
      coaching_customer: quota({
        limit: 10,
        unitLabel: "lượt",
        period: "rolling_24_hours",
        periodLabel: "24 giờ",
        scope: "user",
        scopeLabel: "user",
        enforcement: "server_rate_limit",
        windowMs: DAY_MS,
      }),
      trainer: quota({
        limit: 10,
        unitLabel: "lượt",
        period: "rolling_24_hours",
        periodLabel: "24 giờ",
        scope: "user",
        scopeLabel: "user",
        enforcement: "server_rate_limit",
        windowMs: DAY_MS,
      }),
      fitness_plus_essential: quota({
        limit: 15,
        unitLabel: "lượt",
        period: "rolling_30_days",
        periodLabel: "30 ngày",
        scope: "user",
        scopeLabel: "user",
        enforcement: "server_rate_limit",
        windowMs: 30 * DAY_MS,
      }),
      fitness_plus_smart: quota({
        limit: 30,
        unitLabel: "lượt",
        period: "rolling_30_days",
        periodLabel: "30 ngày",
        scope: "user",
        scopeLabel: "user",
        enforcement: "server_rate_limit",
        windowMs: 30 * DAY_MS,
      }),
      fitness_plus_max: quota({
        limit: 60,
        unitLabel: "lượt",
        period: "rolling_30_days",
        periodLabel: "30 ngày",
        scope: "user",
        scopeLabel: "user",
        enforcement: "server_rate_limit",
        windowMs: 30 * DAY_MS,
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
        period: "rolling_hour",
        periodLabel: "giờ",
        scope: "ip",
        scopeLabel: "IP",
        enforcement: "server_rate_limit",
        windowMs: HOUR_MS,
      }),
      user: quota({
        limit: 15,
        unitLabel: "tin",
        period: "rolling_hour",
        periodLabel: "giờ",
        scope: "user",
        scopeLabel: "user",
        enforcement: "server_rate_limit",
        windowMs: HOUR_MS,
      }),
      coaching_customer: quota({
        limit: 30,
        unitLabel: "tin",
        period: "rolling_hour",
        periodLabel: "giờ",
        scope: "user",
        scopeLabel: "user",
        enforcement: "server_rate_limit",
        windowMs: HOUR_MS,
      }),
      trainer: quota({
        limit: 30,
        unitLabel: "tin",
        period: "rolling_hour",
        periodLabel: "giờ",
        scope: "user",
        scopeLabel: "user",
        enforcement: "server_rate_limit",
        windowMs: HOUR_MS,
      }),
      fitness_plus_essential: quota({
        limit: 20,
        unitLabel: "tin",
        period: "rolling_hour",
        periodLabel: "giờ",
        scope: "user",
        scopeLabel: "user",
        enforcement: "server_rate_limit",
        windowMs: HOUR_MS,
      }),
      fitness_plus_smart: quota({
        limit: 40,
        unitLabel: "tin",
        period: "rolling_hour",
        periodLabel: "giờ",
        scope: "user",
        scopeLabel: "user",
        enforcement: "server_rate_limit",
        windowMs: HOUR_MS,
      }),
      fitness_plus_max: quota({
        limit: 60,
        unitLabel: "tin",
        period: "rolling_hour",
        periodLabel: "giờ",
        scope: "user",
        scopeLabel: "user",
        enforcement: "server_rate_limit",
        windowMs: HOUR_MS,
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
