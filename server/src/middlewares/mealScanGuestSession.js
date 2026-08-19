import { createHmac, randomBytes, randomUUID } from "node:crypto";

export const MEAL_SCAN_GUEST_COOKIE_NAME = "htMealScanGuest";
const MEAL_SCAN_GUEST_COOKIE_MAX_AGE_MS = 400 * 24 * 60 * 60 * 1000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fallbackSecret = randomBytes(32).toString("hex");

const guestCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  path: "/",
  maxAge: MEAL_SCAN_GUEST_COOKIE_MAX_AGE_MS,
});

const guestHashSecret = () =>
  process.env.MEAL_SCAN_GUEST_SESSION_SECRET ||
  process.env.LOG_HASH_SECRET ||
  process.env.JWT_SECRET ||
  fallbackSecret;

export const hashMealScanGuestSessionId = (sessionId) =>
  createHmac("sha256", guestHashSecret()).update(sessionId).digest("hex");

export const ensureMealScanActor = (req, res, next) => {
  if (req.user?.id) {
    req.mealScanActor = { kind: "user", userId: req.user.id };
    return next();
  }

  let sessionId = req.cookies?.[MEAL_SCAN_GUEST_COOKIE_NAME];
  if (!UUID_PATTERN.test(String(sessionId || ""))) {
    sessionId = randomUUID();
    res.cookie(MEAL_SCAN_GUEST_COOKIE_NAME, sessionId, guestCookieOptions());
  }
  req.mealScanActor = {
    kind: "guest",
    guestKey: hashMealScanGuestSessionId(sessionId),
  };
  return next();
};
