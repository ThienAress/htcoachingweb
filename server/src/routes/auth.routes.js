import express from "express";
import { safeLog } from "../utils/safeLogger.js";
import passport from "passport";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

import {
  refreshTokenController,
  logout,
} from "../controllers/auth.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { csrfProtection, generateCsrfToken } from "../middlewares/csrf.js";
import { setCsrfCookie } from "../utils/csrfCookie.js";
import {
  createOAuthState,
  generateOAuthNonce,
  isDevLoginEnabled,
  isLoopbackAddress,
  OAUTH_STATE_MAX_AGE_MS,
  verifyOAuthState,
} from "../utils/oauthState.js";

const router = express.Router();
const isProd = process.env.NODE_ENV === "production";

// ===== COOKIE HELPERS =====
const getAuthCookieOptions = (maxAge = null) => {
  const options = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
  };

  if (maxAge) {
    options.maxAge = maxAge;
  }

  return options;
};

const getCsrfCookieOptions = () => ({
  httpOnly: false,
  secure: isProd,
  sameSite: isProd ? "none" : "lax",
  path: "/",
  maxAge: 24 * 60 * 60 * 1000,
});

const signAccessToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "15m",
  });

const signRefreshToken = (user) =>
  jwt.sign({ id: user._id }, process.env.REFRESH_SECRET, {
    expiresIn: "7d",
  });

const setAuthCookies = (res, accessToken, refreshToken) => {
  // Xóa cookie cũ (không có domain) để tránh trùng lặp trên production
  if (isProd) {
    res.clearCookie("csrfToken", { path: "/", httpOnly: false, secure: true, sameSite: "none" });
    res.clearCookie("accessToken", { path: "/", httpOnly: true, secure: true, sameSite: "none" });
    res.clearCookie("refreshToken", { path: "/", httpOnly: true, secure: true, sameSite: "none" });
  }

  res.cookie("accessToken", accessToken, getAuthCookieOptions(15 * 60 * 1000));
  res.cookie(
    "refreshToken",
    refreshToken,
    getAuthCookieOptions(7 * 24 * 60 * 60 * 1000),
  );

  const csrfToken = generateCsrfToken();
  setCsrfCookie(res, csrfToken, getCsrfCookieOptions());
};

// ===== OAUTH STATE HELPERS (HMAC signed) =====
const OAUTH_STATE_COOKIE = "googleOAuthState";
const OAUTH_CALLBACK_PATH = "/api/auth/google/callback";
const getOAuthStateCookieOptions = (includeMaxAge = true) => ({
  httpOnly: true,
  secure: isProd,
  sameSite: "lax",
  path: OAUTH_CALLBACK_PATH,
  ...(includeMaxAge ? { maxAge: OAUTH_STATE_MAX_AGE_MS } : {}),
});

// Redirect allowlist: production + localhost + explicit previews
const getRedirectAllowlist = () => {
  const list = [process.env.CLIENT_URL];
  if (!isProd) list.push("http://localhost:5173");
  const previews = process.env.PREVIEW_ORIGINS
    ? process.env.PREVIEW_ORIGINS.split(",").map((o) => o.trim())
    : [];
  return [...list, ...previews].filter(Boolean);
};

const rejectInvalidOAuthState = (req, res, next) => {
  const decoded = verifyOAuthState({
    state: req.query.state,
    secret: process.env.JWT_SECRET,
    expectedNonce: req.cookies[OAUTH_STATE_COOKIE],
  });
  res.clearCookie(
    OAUTH_STATE_COOKIE,
    getOAuthStateCookieOptions(false),
  );
  if (!decoded) {
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    return res.redirect(`${clientUrl}/login?error=invalid_oauth_state`);
  }
  req.googleOAuthState = decoded;
  return next();
};

// ===== GOOGLE OAUTH =====
router.get(
  "/google",
  (req, res, next) => {
    const clientUrl = req.query.client_url || process.env.CLIENT_URL;
    const nonce = generateOAuthNonce();
    const state = createOAuthState({
      secret: process.env.JWT_SECRET,
      clientUrl,
      nonce,
    });
    res.cookie(
      OAUTH_STATE_COOKIE,
      nonce,
      getOAuthStateCookieOptions(),
    );
    
    passport.authenticate("google", {
      scope: ["profile", "email"],
      prompt: "select_account",
      state: state,
    })(req, res, next);
  }
);

router.get(
  "/google/callback",
  rejectInvalidOAuthState,
  passport.authenticate("google", { session: false }),
  async (req, res) => {
    try {
      const user = req.user;
      
      // Mặc định là CLIENT_URL trong env
      let clientUrl = process.env.CLIENT_URL;

      const stateClientUrl = req.googleOAuthState?.clientUrl;
      if (stateClientUrl) {
        const allowlist = getRedirectAllowlist();
        if (allowlist.includes(stateClientUrl)) {
          clientUrl = stateClientUrl;
        }
      }

      if (!user) {
        return res.redirect(
          `${clientUrl}/login?error=google_auth`,
        );
      }

      const accessToken = signAccessToken(user);
      const refreshToken = signRefreshToken(user);

      // QUAN TRỌNG: hash refresh token giống auth.controller.js
      const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
      user.refreshToken = hashedRefreshToken;
      await user.save();

      setAuthCookies(res, accessToken, refreshToken);

      return res.redirect(`${clientUrl}/login-success`);
    } catch (err) {
      safeLog.error("auth.google_callback_failed", err);
      // Fallback url nếu lỗi ko lấy được state
      return res.redirect(`${process.env.CLIENT_URL}/login?error=server`);
    }
  },
);

// ===== DEV BYPASS LOGIN =====
if (isDevLoginEnabled(process.env)) {
  router.get("/dev-login", async (req, res) => {
    try {
      if (!isLoopbackAddress(req.socket?.remoteAddress || req.ip)) {
        return res.status(404).json({
          success: false,
          message: "Not found",
        });
      }
      const { email } = req.query;
      const User = (await import("../models/User.js")).default;
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      const accessToken = signAccessToken(user);
      const refreshToken = signRefreshToken(user);

      const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
      user.refreshToken = hashedRefreshToken;
      await user.save();

      setAuthCookies(res, accessToken, refreshToken);
      return res.redirect(`${process.env.CLIENT_URL || "http://localhost:5173"}/login-success`);
    } catch (err) {
      safeLog.error("auth.google_callback_unhandled", err);
      return res.status(500).json({ success: false, message: "Dev login failed" });
    }
  });
}

// ===== REFRESH / LOGOUT =====
router.post("/refresh", csrfProtection, refreshTokenController);
router.post("/logout", protect, csrfProtection, logout);

export default router;
