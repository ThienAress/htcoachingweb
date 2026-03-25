import express from "express";
import passport from "passport";
import jwt from "jsonwebtoken";
import { loginAdmin } from "../controllers/auth.controller.js";
import { loginTrainer } from "../controllers/auth.controller.js";
import { refreshTokenController } from "../controllers/auth.controller.js";
import { logout } from "../controllers/auth.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Google login
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  }),
);

// callback
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  (req, res) => {
    const token = jwt.sign(
      { id: req.user._id, role: req.user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.redirect(`${process.env.CLIENT_URL}/login-success?token=${token}`);
  },
);

router.get("/debug", (req, res) => {
  res.send("AUTH ROUTE OK");
});

router.get("/check-admin-login", (req, res) => {
  res.send("ADMIN LOGIN ROUTE EXISTS");
});

// 👉 ADMIN LOGIN
router.post("/admin/login", loginAdmin);

router.post("/trainer/login", loginTrainer);

router.post("/refresh", refreshTokenController);

router.post("/logout", protect, logout);

export default router;
