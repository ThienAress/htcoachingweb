
import dns from "dns";
// ================= IMPORT =================
import "./src/config/env.js"; // Load env TRƯỚC TẤT CẢ
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import express from "express";
import cors from "cors";
import passport from "passport";
import cookieParser from "cookie-parser";
import helmet from "helmet";
// import mongoSanitize from "express-mongo-sanitize"; // Không tương thích Express 5
import morgan from "morgan";

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
import customerStoryRoutes from "./src/routes/customerStory.routes.js";
import depositRoutes from "./src/routes/deposit.routes.js";
import mealplanAccessRoutes from "./src/routes/mealplanAccess.routes.js";
import { getMyWallet } from "./src/routes/deposit.routes.js";
import { startDepositCronJobs } from "./src/services/depositCron.js";
import { startSubscriptionCronJobs } from "./src/services/subscriptionCron.js";
import { startScheduleReminderCron } from "./src/services/scheduleReminderCron.js";
import { startContractCronJobs } from "./src/services/contractCron.js";
import { startCleanupCronJobs } from "./src/services/cleanupCron.js";

import { generateCsrfToken } from "./src/middlewares/csrf.js";
import { errorHandler } from "./src/middlewares/errorHandler.js";



if (process.env.NODE_ENV !== "production") {
  dns.setServers(["1.1.1.1", "1.0.0.1"]);
}

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

    // Allow Netlify preview/staging domains dynamically
    if (origin.startsWith("https://") && origin.endsWith(".netlify.app")) {
      return callback(null, true);
    }

    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
  exposedHeaders: ["X-CSRF-Token"],
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
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
// express-mongo-sanitize v2.x không tương thích Express 5 (req.query read-only)
// Custom sanitize middleware: chỉ sanitize body và params
const sanitizeMongo = (obj) => {
  if (!obj || typeof obj !== "object") return obj;
  const keys = Object.keys(obj);
  for (const key of keys) {
    if (key.startsWith("$") || key.includes(".")) {
      delete obj[key];
    } else if (typeof obj[key] === "object") {
      sanitizeMongo(obj[key]);
    }
  }
  return obj;
};
app.use((req, res, next) => {
  if (req.body) sanitizeMongo(req.body);
  if (req.params) sanitizeMongo(req.params);
  next();
});
app.use(cookieParser());
app.use(passport.initialize());

// ================= LOGGING =================
app.use(morgan(isProd ? "combined" : "dev"));

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
  let token = req.cookies.csrfToken;
  if (!token) {
    token = generateCsrfToken();
    res.cookie("csrfToken", token, getCsrfCookieOptions());
  }
  // Expose token qua header để Frontend khác domain có thể đọc được
  res.setHeader("X-CSRF-Token", token);
  next();
});

// ================= ROUTES =================
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/checkin", checkinRoutes);
app.use("/api/f1-customers", f1CustomerRoutes);
import f1AiRuleRoutes from "./src/routes/f1AiRule.routes.js";
app.use("/api/f1-ai-rules", f1AiRuleRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/foods", foodRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/exercises", exerciseRoutes);
app.use("/api/exercise-suggestions", exerciseSuggestionRoutes);
app.use("/api/customer-stories", customerStoryRoutes);

import trainerRoutes from "./src/routes/trainer.routes.js";
app.use("/api/trainers", trainerRoutes);

app.use("/api/deposits", depositRoutes);
app.use("/api/mealplan-access", mealplanAccessRoutes);
import adminDepositRoutes from "./src/routes/adminDeposit.routes.js";
app.use("/api/admin/deposits", adminDepositRoutes);

import trainerSubscriptionRoutes from "./src/routes/trainerSubscription.routes.js";
app.use("/api/trainer-subscriptions", trainerSubscriptionRoutes);

import trainingScheduleRoutes from "./src/routes/trainingSchedule.routes.js";
app.use("/api/training-schedules", trainingScheduleRoutes);

import trainingBookingRoutes from "./src/routes/trainingBooking.routes.js";
app.use("/api/training-booking", trainingBookingRoutes);

import coachingRoutes from "./src/routes/coaching.routes.js";
app.use("/api/coaching", coachingRoutes);

import siteSettingRoutes from "./src/routes/siteSetting.routes.js";
app.use("/api/site-settings", siteSettingRoutes);

import workoutPlanRoutes from "./src/routes/workoutPlan.routes.js";
app.use("/api/workout-plans", workoutPlanRoutes);

import gymRoutes from "./src/routes/gym.routes.js";
app.use("/api/gyms", gymRoutes);

import aiRoutes from "./src/routes/ai.routes.js";
app.use("/api/ai", aiRoutes);

import contractRoutes from "./src/routes/contract.routes.js";
app.use("/api/contracts", contractRoutes);

import blogRoutes from "./src/routes/blog.routes.js";
app.use("/api/blog", blogRoutes);

import knowledgeBaseRoutes from "./src/routes/knowledgeBase.routes.js";
app.use("/api/knowledge-base", knowledgeBaseRoutes);

import { protect } from "./src/middlewares/auth.middleware.js";
app.get("/api/me/wallet", protect, getMyWallet);

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

  // Khởi động Cron Jobs
  startDepositCronJobs();
  startSubscriptionCronJobs();
  startScheduleReminderCron();
  startContractCronJobs();
  startCleanupCronJobs();
});
