export const TRAINER_CATALOG_CURRENCY = "VND";
export const TRAINER_CATALOG_PROTOCOL_VERSION = 1;

export const TRAINER_PLAN_DEFINITIONS = Object.freeze([
  Object.freeze({
    code: "free",
    title: "Free",
    prices: Object.freeze({ trial: 0 }),
    billingCycles: Object.freeze(["trial"]),
    durationDays: 30,
    maxClients: 3,
    entitlements: Object.freeze({ f1CrmAi: false }),
  }),
  Object.freeze({
    code: "standard",
    title: "Tiêu chuẩn",
    prices: Object.freeze({ month: 200000, year: 2000000 }),
    billingCycles: Object.freeze(["month", "year"]),
    durationDays: null,
    maxClients: 5,
    entitlements: Object.freeze({ f1CrmAi: false }),
  }),
  Object.freeze({
    code: "professional",
    title: "Chuyên nghiệp",
    prices: Object.freeze({ month: 250000, year: 2500000 }),
    billingCycles: Object.freeze(["month", "year"]),
    durationDays: null,
    maxClients: 20,
    entitlements: Object.freeze({ f1CrmAi: true }),
  }),
  Object.freeze({
    code: "premium",
    title: "Cao cấp",
    prices: Object.freeze({ month: 300000, year: 3000000 }),
    billingCycles: Object.freeze(["month", "year"]),
    durationDays: null,
    maxClients: 50,
    entitlements: Object.freeze({ f1CrmAi: true }),
  }),
]);

export const TRAINER_PLAN_CODES = Object.freeze(
  TRAINER_PLAN_DEFINITIONS.map((plan) => plan.code),
);

export const TRAINER_BILLING_CYCLES = Object.freeze(
  [...new Set(TRAINER_PLAN_DEFINITIONS.flatMap((plan) => plan.billingCycles))],
);
