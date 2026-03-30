import express from "express";
import passport from "passport";
import jwt from "jsonwebtoken";
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

// Helper cookie options cho production (cross-domain)
const getCookieOptions = (maxAge = null) => {
  const options = {
    httpOnly: true,
    secure: true, // Bắt buộc với sameSite=none
    sameSite: "none",
  };
  if (maxAge) options.maxAge = maxAge;
  return options;
};

const getCsrfCookieOptions = () => ({
  httpOnly: false,
  secure: true,
  sameSite: "none",
  maxAge: 24 * 60 * 60 * 1000,
});

// Google OAuth routes
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
  (req, res) => {
    const user = req.user;

    const accessToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "15m" },
    );
    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.REFRESH_SECRET,
      { expiresIn: "7d" },
    );

    // Lưu refresh token (nên hash, nhưng giữ plain cho đơn giản)
    user.refreshToken = refreshToken;
    user.save().catch((err) => console.error("Save refresh token error:", err));

    // Set cookies với cấu hình đúng cho cross-domain
    res.cookie("accessToken", accessToken, getCookieOptions(15 * 60 * 1000));
    res.cookie(
      "refreshToken",
      refreshToken,
      getCookieOptions(7 * 24 * 60 * 60 * 1000),
    );

    // Set CSRF token cookie
    const csrfToken = generateCsrfToken();
    res.cookie("csrfToken", csrfToken, getCsrfCookieOptions());

    // Redirect về frontend
    res.redirect(`${process.env.CLIENT_URL}/login-success`);
  },
);

// Admin & Trainer login
router.post("/admin/login", validateLogin, csrfProtection, loginAdmin);
router.post("/trainer/login", validateLogin, csrfProtection, loginTrainer);

// Refresh token & logout
router.post("/refresh", csrfProtection, refreshTokenController);
router.post("/logout", protect, /* csrfProtection, */ logout);

export default router;
