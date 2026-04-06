import express from "express";
import passport from "passport";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

import {
  loginAdmin,
  loginTrainer,
  refreshTokenController,
  logout,
} from "../controllers/auth.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { validateLogin } from "../middlewares/validation.js";
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
  res.cookie("accessToken", accessToken, getAuthCookieOptions(15 * 60 * 1000));
  res.cookie(
    "refreshToken",
    refreshToken,
    getAuthCookieOptions(7 * 24 * 60 * 60 * 1000),
  );

  const csrfToken = generateCsrfToken();
  res.cookie("csrfToken", csrfToken, getCsrfCookieOptions());
};

// ===== GOOGLE OAUTH =====
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  }),
);

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  async (req, res) => {
    try {
      const user = req.user;

      if (!user) {
        return res.redirect(
          `${process.env.CLIENT_URL}/login?error=google_auth`,
        );
      }

      const accessToken = signAccessToken(user);
      const refreshToken = signRefreshToken(user);

      // QUAN TRỌNG: hash refresh token giống auth.controller.js
      const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
      user.refreshToken = hashedRefreshToken;
      await user.save();

      setAuthCookies(res, accessToken, refreshToken);

      return res.redirect(`${process.env.CLIENT_URL}/login-success`);
    } catch (err) {
      console.error("[GOOGLE CALLBACK ERROR]:", err);
      return res.redirect(`${process.env.CLIENT_URL}/login?error=server`);
    }
  },
);

// ===== ADMIN / TRAINER LOGIN =====
router.post("/admin/login", validateLogin, loginAdmin);
router.post("/trainer/login", validateLogin, loginTrainer);

// ===== REFRESH / LOGOUT =====
router.post("/refresh", csrfProtection, refreshTokenController);
router.post("/logout", protect, logout);

export default router;
