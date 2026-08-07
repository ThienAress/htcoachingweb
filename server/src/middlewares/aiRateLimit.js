import { createHmac, randomBytes } from "node:crypto";

import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import {
  resolveRequestServicePolicy,
  serializeRequestQuota,
} from "../services/serviceAccessPolicy.service.js";

const getQuotaLimit = (serviceKey) => async (req) => {
  const { policy } = await resolveRequestServicePolicy(req, serviceKey);
  if (policy.mode !== "quota" || !Number.isSafeInteger(policy.limit)) {
    throw new Error(`Service ${serviceKey} does not define a rate-limit quota`);
  }
  return policy.limit;
};

const quotaHandler = ({ serviceKey, code, message }) => (req, res) => {
  const quota = serializeRequestQuota(req, serviceKey);
  return res.status(429).json({
    success: false,
    code,
    message: message(quota),
    meta: { quota },
  });
};

// AI Chat authenticated rate limit — per user; guest dùng limiter riêng theo IP HMAC.
export const aiChatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 giờ
  limit: getQuotaLimit("ai_chat"),
  skip: (req) => !req.user?.id,
  keyGenerator: (req) => req.user.id.toString(),
  handler: quotaHandler({
    serviceKey: "ai_chat",
    code: "AI_RATE_LIMITED",
    message: (quota) =>
      `Bạn đã dùng hết ${quota?.limit || 15} tin trong giờ này. Vui lòng thử lại sau.`,
  }),
  standardHeaders: true,
  legacyHeaders: false,
});

const anonymousAiChatKeySalt = randomBytes(32);

const createAnonymousAiChatKey = (req) =>
  createHmac(
    "sha256",
    process.env.AI_GUEST_RATE_LIMIT_SECRET ||
      process.env.LOG_HASH_SECRET ||
      process.env.JWT_SECRET ||
      anonymousAiChatKeySalt,
  )
    .update(ipKeyGenerator(req.ip))
    .digest("hex");

export const aiGuestChatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: getQuotaLimit("ai_chat"),
  skip: (req) => Boolean(req.user?.id),
  keyGenerator: createAnonymousAiChatKey,
  handler: quotaHandler({
    serviceKey: "ai_chat",
    code: "AI_GUEST_RATE_LIMITED",
    message: (quota) =>
      `Bạn đã dùng hết ${quota?.limit || 5} lượt hỏi miễn phí trong giờ này. Đăng nhập để tiếp tục.`,
  }),
  standardHeaders: true,
  legacyHeaders: false,
});

const anonymousMealScanKeySalt = randomBytes(32);

const createAnonymousMealScanKey = (req) =>
  createHmac("sha256", anonymousMealScanKeySalt)
    .update(ipKeyGenerator(req.ip))
    .digest("hex");

export const mealScanAnonymousLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: getQuotaLimit("meal_scan"),
  skip: (req) => Boolean(req.user?.id),
  keyGenerator: createAnonymousMealScanKey,
  handler: quotaHandler({
    serviceKey: "meal_scan",
    code: "MEAL_SCAN_ANONYMOUS_LIMITED",
    message: (quota) =>
      `Bạn đã dùng hết ${quota?.limit || 2} lượt quét miễn phí trong 24 giờ. Đăng nhập để tiếp tục.`,
  }),
  standardHeaders: true,
  legacyHeaders: false,
});

export const mealScanLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: getQuotaLimit("meal_scan"),
  skip: (req) => !req.user?.id,
  keyGenerator: (req) => req.user.id.toString(),
  handler: quotaHandler({
    serviceKey: "meal_scan",
    code: "MEAL_SCAN_RATE_LIMITED",
    message: (quota) =>
      `Bạn đã dùng hết ${quota?.limit || 3} lượt quét trong 24 giờ. Vui lòng thử lại sau.`,
  }),
  standardHeaders: true,
  legacyHeaders: false,
});
