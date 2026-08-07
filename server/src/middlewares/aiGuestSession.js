import { createHmac, randomBytes, randomUUID } from "node:crypto";

export const AI_GUEST_COOKIE_NAME = "htAiGuest";
const AI_GUEST_COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fallbackSecret = randomBytes(32).toString("hex");

const guestCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  path: "/",
  maxAge: AI_GUEST_COOKIE_MAX_AGE_MS,
});

const guestHashSecret = () =>
  process.env.AI_GUEST_SESSION_SECRET ||
  process.env.LOG_HASH_SECRET ||
  process.env.JWT_SECRET ||
  fallbackSecret;

export const hashAiGuestSessionId = (sessionId) =>
  createHmac("sha256", guestHashSecret()).update(sessionId).digest("hex");

export const ensureAiActor = (req, res, next) => {
  if (req.user?.id) {
    req.aiActor = { kind: "user", userId: req.user.id };
    return next();
  }

  let sessionId = req.cookies?.[AI_GUEST_COOKIE_NAME];
  if (!UUID_PATTERN.test(String(sessionId || ""))) {
    sessionId = randomUUID();
    res.cookie(AI_GUEST_COOKIE_NAME, sessionId, guestCookieOptions());
  }

  req.aiActor = {
    kind: "guest",
    guestKey: hashAiGuestSessionId(sessionId),
  };
  return next();
};
