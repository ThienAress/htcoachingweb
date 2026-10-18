// Nội dung bảng giá do admin chỉnh. Khóa khớp với server/src/utils/pricingContent.js.
export const PRICING_CONTENT_TABS = Object.freeze([
  { tab: "1-1", label: "1-1" },
  { tab: "online", label: "ONLINE" },
  { tab: "trial", label: "Trải nghiệm" },
]);

export const MAX_PRICING_CONTENT_ITEMS = 12;
export const MAX_PRICING_CONTENT_LENGTH = 160;

export const DEFAULT_LOGIN_PROMO = Object.freeze({ enabled: true, percent: 15 });
export const MIN_LOGIN_PROMO_PERCENT = 1;
export const MAX_LOGIN_PROMO_PERCENT = 100;

const CUSTOMER_KEYS = [
  "personalized_plan",
  "diet_consultation",
  "weekly_progress",
  "notion_tracking",
  "stretching_recovery",
  "commitment",
];
const SYSTEM_KEYS = [
  "exercise_library",
  "ai_mealplan",
  "online_booking",
  "personal_schedule",
  "checkin_history",
];

// Quyền lợi gốc (khi admin chưa lưu). Tab ONLINE khác ở dòng đầu: tập online thay cho tập 1 kèm 1.
export const buildDefaultPricingContent = (t) => {
  const system = SYSTEM_KEYS.map((key) => t(`pricing.system_features.${key}`));
  const customer = (firstKey) => [
    t(`pricing.features.${firstKey}`),
    ...CUSTOMER_KEYS.map((key) => t(`pricing.features.${key}`)),
  ];
  return {
    "1-1-customer": customer("one_on_one"),
    "1-1-system": system,
    "online-customer": customer("online"),
    "online-system": system,
    "trial-customer": customer("one_on_one"),
    "trial-system": system,
  };
};

// Admin đã lưu danh sách (luôn có ít nhất một dòng) thì dùng, chưa lưu thì dùng quyền lợi gốc.
export const resolvePricingContent = (overrides, key, defaults = []) => {
  const saved = overrides?.[key];
  return Array.isArray(saved) && saved.length > 0 ? saved : defaults;
};

export const resolveLoginPromo = (settings) => {
  const saved = settings?.loginPromo;
  return {
    enabled: typeof saved?.enabled === "boolean" ? saved.enabled : DEFAULT_LOGIN_PROMO.enabled,
    percent: Number.isInteger(saved?.percent) ? saved.percent : DEFAULT_LOGIN_PROMO.percent,
  };
};

export const validateBenefits = (items) => {
  if (items.length === 0) return "Cần ít nhất một quyền lợi";
  if (items.length > MAX_PRICING_CONTENT_ITEMS) {
    return `Mỗi danh sách tối đa ${MAX_PRICING_CONTENT_ITEMS} quyền lợi`;
  }
  if (items.some((item) => item.length > MAX_PRICING_CONTENT_LENGTH)) {
    return `Mỗi quyền lợi tối đa ${MAX_PRICING_CONTENT_LENGTH} ký tự`;
  }
  return "";
};
