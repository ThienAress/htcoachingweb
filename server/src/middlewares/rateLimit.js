import rateLimit from "express-rate-limit";

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: {
    success: false,
    message: "Quá nhiều yêu cầu, vui lòng thử lại sau 15 phút",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: "Quá nhiều lần thử, vui lòng thử lại sau 15 phút",
  },
});

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: {
    success: false,
    message: "Quá nhiều yêu cầu, vui lòng thử lại sau",
  },
});

export const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: false,
  message: {
    success: false,
    message: "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 5, // tối đa 5 lần đăng ký / IP
  message: {
    success: false,
    message: "Bạn đã gửi quá nhiều đăng ký. Vui lòng thử lại sau 15 phút.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const exerciseSuggestionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 giờ
  max: 5, // tối đa 5 góp ý
  message: {
    success: false,
    message: "Bạn đã gửi quá nhiều góp ý. Vui lòng thử lại sau 1 giờ.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const f1GenerationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Đã đạt giới hạn tạo artifact F1. Vui lòng thử lại sau.",
  },
});

export const scheduleMutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Quá nhiều thay đổi lịch tập. Vui lòng thử lại sau.",
  },
});

export const todayDashboardReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Quá nhiều yêu cầu tải Today Dashboard. Vui lòng thử lại sau.",
  },
});

export const dailyJournalMutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Quá nhiều thay đổi nhật ký. Vui lòng thử lại sau.",
  },
});

export const wellnessTargetMutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Quá nhiều thay đổi mục tiêu sức khỏe. Vui lòng thử lại sau.",
  },
});
export const savedMealPlanMutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Quá nhiều thay đổi meal plan. Vui lòng thử lại sau.",
  },
});

export const coachingHabitMutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Quá nhiều thay đổi Coaching Habit. Vui lòng thử lại sau.",
  },
});

export const weeklyCheckinMutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Quá nhiều thay đổi Weekly Check-in. Vui lòng thử lại sau.",
  },
});

export const progressReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Quá nhiều yêu cầu tải tiến trình. Vui lòng thử lại sau.",
  },
});

export const coachingCommentMutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Quá nhiều thao tác comment. Vui lòng thử lại sau.",
  },
});

export const notificationMutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Quá nhiều thao tác notification. Vui lòng thử lại sau.",
  },
});

export const aiConfirmationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.user?.id?.toString() ?? "anonymous",
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: "AI_CONFIRMATION_RATE_LIMITED",
    message: "Quá nhiều yêu cầu xác nhận. Vui lòng thử lại sau.",
  },
});

export const financialCommandLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Quá nhiều lệnh tài chính. Vui lòng thử lại sau.",
  },
});

export const rumLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Rate limit exceeded" },
});

export const cspReportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: false,
  legacyHeaders: false,
});

export const foodReferenceLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Math.min(
    Math.max(1, Number(process.env.FOOD_REFERENCE_RATE_LIMIT_MAX) || 30),
    100,
  ),
  keyGenerator: (req) => req.user?.id?.toString() ?? "anonymous",
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: "FOOD_REFERENCE_RATE_LIMITED",
    message: "Bạn đã tra cứu quá nhiều sản phẩm. Vui lòng thử lại sau.",
  },
});

export const analyticsSyncLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.user?.id?.toString() ?? "anonymous",
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: "ANALYTICS_SYNC_RATE_LIMITED",
    message: "Bạn đã yêu cầu đồng bộ quá nhiều lần. Vui lòng thử lại sau.",
  },
});

export const sepayWebhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: "SEPAY_WEBHOOK_RATE_LIMITED",
    message: "Webhook rate limit exceeded",
  },
});

export const skillRadarMutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?.id?.toString() ?? "anonymous",
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: "SKILL_RADAR_MUTATION_RATE_LIMITED",
    message: "Bạn đã phân tích quá nhiều nguồn. Vui lòng thử lại sau.",
  },
});
