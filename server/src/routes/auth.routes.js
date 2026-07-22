import express from "express";
import { safeLog } from "../utils/safeLogger.js";
import passport from "passport";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";

import {
  refreshTokenController,
  logout,
} from "../controllers/auth.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { csrfProtection, generateCsrfToken } from "../middlewares/csrf.js";

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
  res.cookie("csrfToken", csrfToken, getCsrfCookieOptions());
};

// ===== OAUTH STATE HELPERS (HMAC signed) =====
const STATE_SECRET = process.env.JWT_SECRET;
const STATE_MAX_AGE_MS = 5 * 60 * 1000; // 5 phút

const signOAuthState = (payload) => {
  const data = Buffer.from(JSON.stringify({ ...payload, iat: Date.now() })).toString("base64url");
  const sig = crypto.createHmac("sha256", STATE_SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
};

const verifyOAuthState = (state) => {
  if (!state || !state.includes(".")) return null;
  const [data, sig] = state.split(".");
  if (!data || !sig) return null;
  const expected = crypto.createHmac("sha256", STATE_SECRET).update(data).digest("base64url");
  if (Buffer.from(sig).length !== Buffer.from(expected).length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf-8"));
    if (Date.now() - payload.iat > STATE_MAX_AGE_MS) return null;
    return payload;
  } catch {
    return null;
  }
};

// Redirect allowlist: production + localhost + explicit previews
const getRedirectAllowlist = () => {
  const list = [process.env.CLIENT_URL];
  if (!isProd) list.push("http://localhost:5173");
  const previews = process.env.PREVIEW_ORIGINS
    ? process.env.PREVIEW_ORIGINS.split(",").map((o) => o.trim())
    : [];
  return [...list, ...previews].filter(Boolean);
};

// ===== GOOGLE OAUTH =====
router.get(
  "/google",
  (req, res, next) => {
    const clientUrl = req.query.client_url || process.env.CLIENT_URL;
    const state = signOAuthState({ clientUrl });
    
    passport.authenticate("google", {
      scope: ["profile", "email"],
      prompt: "select_account",
      state: state,
    })(req, res, next);
  }
);

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  async (req, res) => {
    try {
      const user = req.user;
      
      // Mặc định là CLIENT_URL trong env
      let clientUrl = process.env.CLIENT_URL;

      // Verify signed state
      if (req.query.state) {
        const decoded = verifyOAuthState(req.query.state);
        if (decoded?.clientUrl) {
          const allowlist = getRedirectAllowlist();
          if (allowlist.includes(decoded.clientUrl)) {
            clientUrl = decoded.clientUrl;
          }
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
if (process.env.NODE_ENV !== "production") {
  router.get("/dev-login", async (req, res) => {
    try {
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
