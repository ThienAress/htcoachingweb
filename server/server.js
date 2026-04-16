// ================= IMPORT =================
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import passport from "passport";
import cookieParser from "cookie-parser";
import helmet from "helmet";

import connectDB from "./src/config/db.js";
import "./src/config/passport.js";

import {
  globalLimiter,
  authLimiter,
  apiLimiter,
  contactLimiter,
} from "./src/middlewares/rateLimit.js";

import authRoutes from "./src/routes/auth.routes.js";
import userRoutes from "./src/routes/user.routes.js";
import orderRoutes from "./src/routes/order.routes.js";
import checkinRoutes from "./src/routes/checkin.routes.js";
import f1CustomerRoutes from "./src/routes/f1Customer.routes.js";
import contactRoutes from "./src/routes/contact.routes.js";
import foodRoutes from "./src/routes/food.routes.js";
import bookingRoutes from "./src/routes/booking.routes.js";
import exerciseRoutes from "./src/routes/exercise.routes.js";
import exerciseSuggestionRoutes from "./src/routes/exerciseSuggestion.routes.js";

import { generateCsrfToken } from "./src/middlewares/csrf.js";
import { errorHandler } from "./src/middlewares/errorHandler.js";

import path from "path";

// ================= INIT APP =================
const app = express();
const isProd = process.env.NODE_ENV === "production";
const PORT = process.env.PORT || 5000;

// ================= TRUST PROXY =================
app.set("trust proxy", 1);

// ================= CONNECT DB =================
connectDB();

// ================= CORS =================
const fallbackOrigins = [
  "https://htcoachingweb.netlify.app",
  "http://localhost:5173",
];

const allowedOrigins = (
  process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
    : fallbackOrigins
).filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Cho phép request không có origin (Postman, mobile app, server-to-server)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
};

app.use(cors(corsOptions));

// ================= SECURITY =================
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
);

// ================= BODY / COOKIE / PASSPORT =================
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

// ================= RATE LIMIT =================
if (isProd) {
  app.use("/api", globalLimiter);
  app.use("/api/auth", authLimiter);
  app.use("/api/orders", apiLimiter);
  app.use("/api/checkin", apiLimiter);
  app.use("/api/contact", contactLimiter);
}

// ================= CSRF COOKIE HELPER =================
const getCsrfCookieOptions = () => ({
  httpOnly: false,
  secure: isProd,
  sameSite: isProd ? "none" : "lax",
  path: "/",
  maxAge: 24 * 60 * 60 * 1000,
});

// ================= CSRF TOKEN GENERATE =================
// Tạo csrfToken nếu client chưa có
app.use((req, res, next) => {
  if (!req.cookies.csrfToken) {
    const newToken = generateCsrfToken();
    res.cookie("csrfToken", newToken, getCsrfCookieOptions());
  }
  next();
});

// ================= ROUTES =================
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/checkin", checkinRoutes);
app.use("/api/f1-customers", f1CustomerRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/foods", foodRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/exercises", exerciseRoutes);
app.use("/api/exercise-suggestions", exerciseSuggestionRoutes);
app.use("/uploads", express.static(path.resolve("uploads")));

// ================= HEALTH CHECK =================
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Server is running",
  });
});

// ================= ERROR HANDLER =================
app.use(errorHandler);

// ================= START SERVER =================
app.listen(PORT, () => {
  console.log(`🚀 Server chạy tại port ${PORT}`);
  console.log("🌐 Allowed origins:", allowedOrigins);
});
