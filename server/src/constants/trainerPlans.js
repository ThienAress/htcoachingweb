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

const ALL_TRAINER_PLAN_CODES = TRAINER_PLAN_CODES;
const F1_TRAINER_PLAN_CODES = Object.freeze(["professional", "premium"]);

const TRAINER_BENEFIT_CATEGORIES = Object.freeze({
  student_management: Object.freeze({
    key: "student_management",
    label: "Quản lý học viên",
  }),
  coaching_schedule: Object.freeze({
    key: "coaching_schedule",
    label: "Coaching & Lịch tập",
  }),
  crm_ai: Object.freeze({ key: "crm_ai", label: "F1 CRM & AI" }),
  privilege: Object.freeze({ key: "privilege", label: "Đặc quyền" }),
});

const benefit = ({
  key,
  label,
  category,
  includedPlanCodes = ALL_TRAINER_PLAN_CODES,
  valueType = "included",
}) =>
  Object.freeze({
    key,
    label,
    category,
    valueType,
    includedPlanCodes,
  });

export const TRAINER_PLAN_BENEFIT_DEFINITIONS = Object.freeze([
  benefit({
    key: "max_students",
    label: "Số học viên quản lý tối đa",
    category: TRAINER_BENEFIT_CATEGORIES.student_management,
    valueType: "capacity",
  }),
  benefit({
    key: "create_profile",
    label: "Tạo hồ sơ tập luyện cho học viên",
    category: TRAINER_BENEFIT_CATEGORIES.student_management,
  }),
  benefit({
    key: "checkin_checkout",
    label: "Checkin/Checkout học viên qua hệ thống",
    category: TRAINER_BENEFIT_CATEGORIES.student_management,
  }),
  benefit({
    key: "checkin_history",
    label: "Xem lịch sử checkin tất cả học viên",
    category: TRAINER_BENEFIT_CATEGORIES.student_management,
  }),
  benefit({
    key: "dashboard",
    label: "Trainer Dashboard — Thống kê tổng quan",
    category: TRAINER_BENEFIT_CATEGORIES.student_management,
  }),
  benefit({
    key: "coaching_feedback",
    label: "Online Coaching — Gửi bài tập & feedback cho học viên",
    category: TRAINER_BENEFIT_CATEGORIES.coaching_schedule,
  }),
  benefit({
    key: "manage_schedule",
    label: "Tạo và quản lý lịch tập cho học viên",
    category: TRAINER_BENEFIT_CATEGORIES.coaching_schedule,
  }),
  benefit({
    key: "crm_leads",
    label: "Hệ thống CRM quản lý khách hàng tiềm năng (F1)",
    category: TRAINER_BENEFIT_CATEGORIES.crm_ai,
    includedPlanCodes: F1_TRAINER_PLAN_CODES,
  }),
  benefit({
    key: "crm_ai_analysis",
    label: "AI phân tích & đánh giá khách hàng F1",
    category: TRAINER_BENEFIT_CATEGORIES.crm_ai,
    includedPlanCodes: F1_TRAINER_PLAN_CODES,
  }),
  benefit({
    key: "crm_ai_prediction",
    label: "Dự đoán kết quả tập luyện bằng AI",
    category: TRAINER_BENEFIT_CATEGORIES.crm_ai,
    includedPlanCodes: F1_TRAINER_PLAN_CODES,
  }),
  benefit({
    key: "crm_ai_report",
    label: "Báo cáo AI chi tiết cho từng khách hàng",
    category: TRAINER_BENEFIT_CATEGORIES.crm_ai,
    includedPlanCodes: F1_TRAINER_PLAN_CODES,
  }),
  benefit({
    key: "free_updates",
    label: "Cập nhật tính năng mới miễn phí",
    category: TRAINER_BENEFIT_CATEGORIES.privilege,
    includedPlanCodes: Object.freeze(["premium"]),
  }),
]);

export const TRAINER_BILLING_CYCLES = Object.freeze(
  [...new Set(TRAINER_PLAN_DEFINITIONS.flatMap((plan) => plan.billingCycles))],
);
