
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
// import mongoSanitize from "express-mongo-sanitize"; // Không tương thích Express 5
import { requestTelemetry } from "./src/middlewares/requestTelemetry.js";
import { createSecurityHeaders } from "./src/middlewares/securityHeaders.js";
import { rejectUnsafeMongoInput } from "./src/middlewares/requestSanitization.js";
import { safeLog } from "./src/utils/safeLogger.js";
import { markRuntimeDraining } from "./src/operations/runtimeState.js";

import connectDB from "./src/config/db.js";
import { getBackgroundJobsMode } from "./src/config/backgroundJobs.js";
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
import { startF1LifecycleCron } from "./src/services/f1PrivacyLifecycle.service.js";

import { generateCsrfToken } from "./src/middlewares/csrf.js";
import { errorHandler } from "./src/middlewares/errorHandler.js";



if (process.env.NODE_ENV !== "production") {
  dns.setServers(["1.1.1.1", "1.0.0.1"]);
}

// ================= INIT APP =================
const app = express();
const isProd = process.env.NODE_ENV === "production";
const PORT = process.env.PORT || 5000;
app.disable("x-powered-by");

app.use(requestTelemetry);

// ================= TRUST PROXY =================
const trustProxyHops = isProd
  ? Number(process.env.TRUST_PROXY_HOPS || 1)
  : false;
app.set("trust proxy", trustProxyHops);

// ================= CORS =================
const fallbackOrigins = [
  "https://htcoachingweb.netlify.app",
  "http://localhost:5173",
];

const allowedOrigins = (
  process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
    : isProd
      ? []
      : fallbackOrigins
).filter(Boolean);
const previewOrigins = (
  process.env.PREVIEW_ORIGINS
    ? process.env.PREVIEW_ORIGINS.split(",").map((origin) => origin.trim())
    : []
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

    // Preview deploys: chỉ cho phép origins được khai báo rõ trong env
    if (previewOrigins.includes(origin)) {
      return callback(null, true);
    }

    const error = new Error("Origin denied by CORS policy");
    error.status = 403;
    error.code = "CORS_ORIGIN_DENIED";
    return callback(error);
  },
  credentials: true,
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-CSRF-Token",
    "X-Request-Id",
    "Traceparent",
  ],
  exposedHeaders: ["X-CSRF-Token", "X-Request-Id", "X-Trace-Id"],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
};

app.use(cors(corsOptions));

// ================= SECURITY =================
app.use(...createSecurityHeaders({ isProduction: isProd, allowedOrigins }));

// ================= BODY / COOKIE / PASSPORT =================
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(rejectUnsafeMongoInput);
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

import recipeRoutes from "./src/routes/recipe.routes.js";
app.use("/api/recipes", recipeRoutes);

import opsRoutes from "./src/routes/ops.routes.js";
app.use("/api/ops", opsRoutes);

import { protect } from "./src/middlewares/auth.middleware.js";
app.get("/api/me/wallet", protect, getMyWallet);

app.use("/uploads/f1-media", (_req, res) => {
  res.status(404).json({ success: false, message: "Not found" });
});
app.use(
  "/uploads",
  express.static(path.resolve(__dirname, "uploads"), {
    dotfiles: "deny",
    index: false,
    fallthrough: true,
    maxAge: isProd ? "1d" : 0,
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  }),
);

// ================= HEALTH CHECK =================
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Server is running",
  });
});

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Not found",
    requestId: req.id,
  });
});

// ================= ERROR HANDLER =================
app.use(errorHandler);

// ================= START SERVER =================
try {
  await connectDB();
} catch (error) {
  safeLog.error("server.start_failed", error);
  process.exit(1);
}

const server = app.listen(PORT, () => {
  safeLog.info("server.started", {
    port: Number(PORT),
    allowedOriginCount: allowedOrigins.length,
    previewOriginCount: previewOrigins.length,
    trustProxyHops: trustProxyHops === false ? 0 : trustProxyHops,
  });

  const backgroundJobs = getBackgroundJobsMode(process.env);
  if (!backgroundJobs.enabled) {
    safeLog.warn(
      "background_jobs.disabled",
      backgroundJobs.explicit
        ? "Disabled by configuration"
        : "Explicit BACKGROUND_JOBS_ENABLED=true is required",
    );
    return;
  }

  // Khởi động Cron Jobs
  startDepositCronJobs();
  startSubscriptionCronJobs();
  startScheduleReminderCron();
  startContractCronJobs();
  startCleanupCronJobs();
  startF1LifecycleCron();
});

server.headersTimeout = Number(
  process.env.SERVER_HEADERS_TIMEOUT_MS || 15_000,
);
server.requestTimeout = Number(
  process.env.SERVER_REQUEST_TIMEOUT_MS || 120_000,
);
server.keepAliveTimeout = Number(
  process.env.SERVER_KEEP_ALIVE_TIMEOUT_MS || 65_000,
);
server.maxHeadersCount = 100;

// ================= GRACEFUL SHUTDOWN =================
let shuttingDown = false;
const gracefulShutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  markRuntimeDraining(signal);
  safeLog.info("server.shutdown_started", { signal });
  const shutdownTimeoutMs = Number(
    process.env.SERVER_SHUTDOWN_TIMEOUT_MS || 15_000,
  );

  // Ngừng nhận request mới, đợi request đang xử lý hoàn thành (timeout 10s)
  server.close(async () => {
    safeLog.info("server.http_closed");
    try {
      const mongoose = (await import("mongoose")).default;
      await mongoose.connection.close();
      safeLog.info("server.database_closed");
    } catch (err) {
      safeLog.error("server.database_close_failed", err);
    }
    process.exit(0);
  });
  server.closeIdleConnections?.();

  // Safety timeout: nếu sau 15s vẫn chưa xong → force exit
  setTimeout(() => {
    safeLog.error("server.shutdown_timeout", new Error("Shutdown timeout"));
    server.closeAllConnections?.();
    process.exit(1);
  }, shutdownTimeoutMs).unref();
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  safeLog.error("server.unhandled_rejection", reason);
  gracefulShutdown("unhandledRejection");
});
process.on("uncaughtException", (error) => {
  safeLog.error("server.uncaught_exception", error);
  gracefulShutdown("uncaughtException");
});
