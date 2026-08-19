export const FITNESS_PLUS_CATALOG_CURRENCY = "VND";
export const FITNESS_PLUS_CATALOG_PROTOCOL_VERSION = 1;

const freeze = (value) => Object.freeze(value);

export const FITNESS_PLUS_PLAN_DEFINITIONS = freeze([
  freeze({
    code: "fitness_plus_essential",
    title: "Nền tảng",
    titleEn: "Essential",
    subtitle: "Bộ công cụ số cốt lõi để tự theo dõi",
    subtitleEn: "Core digital tools for self-tracking",
    prices: freeze({ month: 99_000, year: 990_000 }),
    billingCycles: freeze(["month", "year"]),
    durationDays: null,
    featured: false,
    entitlements: freeze({ digitalTracking: true }),
    features: freeze([
      "core_tools",
      "meal_plan_access",
      "progress_tracking",
    ]),
  }),
  freeze({
    code: "fitness_plus_smart",
    title: "Tăng tốc",
    titleEn: "Smart",
    subtitle: "Mức sử dụng cân bằng cho hành trình đều đặn",
    subtitleEn: "Balanced usage for a consistent journey",
    prices: freeze({ month: 199_000, year: 1_990_000 }),
    billingCycles: freeze(["month", "year"]),
    durationDays: null,
    featured: true,
    entitlements: freeze({ digitalTracking: true }),
    features: freeze([
      "core_tools",
      "meal_plan_access",
      "progress_tracking",
    ]),
  }),
  freeze({
    code: "fitness_plus_max",
    title: "Toàn diện",
    titleEn: "Max",
    subtitle: "Hạn mức rộng cho người dùng công cụ thường xuyên",
    subtitleEn: "More room for frequent tool usage",
    prices: freeze({ month: 299_000, year: 2_990_000 }),
    billingCycles: freeze(["month", "year"]),
    durationDays: null,
    featured: false,
    entitlements: freeze({ digitalTracking: true }),
    features: freeze([
      "core_tools",
      "meal_plan_access",
      "progress_tracking",
    ]),
  }),
]);

export const FITNESS_PLUS_PLAN_CODES = freeze(
  FITNESS_PLUS_PLAN_DEFINITIONS.map((plan) => plan.code),
);

export const FITNESS_PLUS_BILLING_CYCLES = freeze(["month", "year"]);
