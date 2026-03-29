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
import { csrfProtection } from "../middlewares/csrf.js";

const router = express.Router();
const isProd = process.env.NODE_ENV === "production";

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

    user.refreshToken = refreshToken;
    user.save().catch((err) => console.error("Save refresh token error:", err));

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "strict" : "lax",
      maxAge: 15 * 60 * 1000,
    });
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.redirect(`${process.env.CLIENT_URL}/login-success`);
  },
);

router.post("/admin/login", validateLogin, csrfProtection, loginAdmin);
router.post("/trainer/login", validateLogin, csrfProtection, loginTrainer);
router.post("/refresh", csrfProtection, refreshTokenController);
router.post("/logout", protect, csrfProtection, logout);

export default router;
