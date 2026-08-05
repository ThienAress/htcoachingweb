import { createHmac, randomBytes } from "node:crypto";

import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// AI Chat rate limit — per user (dùng userId thay vì IP)
// Route này luôn đi qua protect middleware → req.user.id luôn có
export const aiChatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 giờ
  max: 30, // 30 messages/giờ cho user thường
  keyGenerator: (req) => req.user?.id?.toString() ?? "anonymous",
  message: {
    success: false,
    message: "Bạn đã gửi quá nhiều tin nhắn. Vui lòng thử lại sau 1 giờ.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const authenticatedMealScanDailyLimit = Math.min(
  Math.max(1, Number(process.env.MEAL_SCAN_RATE_LIMIT_MAX) || 10),
  100,
);
const anonymousDailyLimit = Math.min(
  Math.max(1, Number(process.env.MEAL_SCAN_ANONYMOUS_DAILY_LIMIT) || 2),
  10,
);

const anonymousMealScanKeySalt = randomBytes(32);

const createAnonymousMealScanKey = (req) =>
  createHmac("sha256", anonymousMealScanKeySalt)
    .update(ipKeyGenerator(req.ip))
    .digest("hex");

export const mealScanAnonymousLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: anonymousDailyLimit,
  skip: (req) => Boolean(req.user?.id),
  keyGenerator: createAnonymousMealScanKey,
  message: {
    success: false,
    code: "MEAL_SCAN_ANONYMOUS_LIMITED",
    message: `Bạn đã dùng hết ${anonymousDailyLimit} lượt quét miễn phí trong 24 giờ. Đăng nhập để tiếp tục.`,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const mealScanLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: authenticatedMealScanDailyLimit,
  skip: (req) => !req.user?.id,
  keyGenerator: (req) => req.user.id.toString(),
  message: {
    success: false,
    code: "MEAL_SCAN_RATE_LIMITED",
    message: "Bạn đã dùng hết 10 lượt quét trong 24 giờ. Vui lòng thử lại sau.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
