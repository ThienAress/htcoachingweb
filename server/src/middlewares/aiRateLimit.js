import { createHmac, randomBytes } from "node:crypto";

import rateLimit, { ipKeyGenerator } from "express-rate-limit";

export const AI_CHAT_ABUSE_LIMIT = 60;
export const MEAL_SCAN_ABUSE_LIMIT = 30;

const abuseHandler = ({ code, message }) => (_req, res) =>
  res.status(429).json({ success: false, code, message });

// Operational flood ceiling; commercial quotas are enforced by the shared ledger.
export const aiChatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: AI_CHAT_ABUSE_LIMIT,
  skip: (req) => !req.user?.id,
  keyGenerator: (req) => req.user.id.toString(),
  handler: abuseHandler({
    code: "AI_CHAT_ABUSE_RATE_LIMITED",
    message: "Bạn gửi yêu cầu quá nhanh. Vui lòng thử lại sau.",
  }),
  standardHeaders: false,
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
  limit: AI_CHAT_ABUSE_LIMIT,
  skip: (req) => Boolean(req.user?.id),
  keyGenerator: createAnonymousAiChatKey,
  handler: abuseHandler({
    code: "AI_GUEST_ABUSE_RATE_LIMITED",
    message: "Bạn gửi yêu cầu quá nhanh. Vui lòng thử lại sau.",
  }),
  standardHeaders: false,
  legacyHeaders: false,
});

const anonymousMealScanKeySalt = randomBytes(32);

const createAnonymousMealScanKey = (req) =>
  createHmac("sha256", anonymousMealScanKeySalt)
    .update(ipKeyGenerator(req.ip))
    .digest("hex");

export const mealScanAnonymousLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: MEAL_SCAN_ABUSE_LIMIT,
  skip: (req) => Boolean(req.user?.id),
  keyGenerator: createAnonymousMealScanKey,
  handler: abuseHandler({
    code: "MEAL_SCAN_ANONYMOUS_ABUSE_RATE_LIMITED",
    message: "Bạn gửi yêu cầu quét quá nhanh. Vui lòng thử lại sau.",
  }),
  standardHeaders: false,
  legacyHeaders: false,
});

export const mealScanLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: MEAL_SCAN_ABUSE_LIMIT,
  skip: (req) => !req.user?.id,
  keyGenerator: (req) => req.user.id.toString(),
  handler: abuseHandler({
    code: "MEAL_SCAN_ABUSE_RATE_LIMITED",
    message: "Bạn gửi yêu cầu quét quá nhanh. Vui lòng thử lại sau.",
  }),
  standardHeaders: false,
  legacyHeaders: false,
});
