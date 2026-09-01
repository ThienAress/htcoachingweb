import rateLimit from "express-rate-limit";

export const PRACTICE_CENTER_ABUSE_LIMIT = 30;

export const practiceCenterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: PRACTICE_CENTER_ABUSE_LIMIT,
  keyGenerator: (req) => req.user.id.toString(),
  handler: (_req, res) =>
    res.status(429).json({
      success: false,
      code: "PRACTICE_CENTER_ABUSE_RATE_LIMITED",
      message: "Bạn gửi yêu cầu quá nhanh. Vui lòng thử lại sau.",
    }),
  standardHeaders: false,
  legacyHeaders: false,
});
