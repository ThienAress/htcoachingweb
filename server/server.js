// ================= IMPORT =================
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import passport from "passport";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

import connectDB from "./src/config/db.js";
import "./src/config/passport.js";

import authRoutes from "./src/routes/auth.routes.js";
import userRoutes from "./src/routes/user.routes.js";
import orderRoutes from "./src/routes/order.routes.js";
import checkinRoutes from "./src/routes/checkin.routes.js";

import { generateCsrfToken, csrfProtection } from "./src/middlewares/csrf.js";
import { errorHandler } from "./src/middlewares/errorHandler.js";

// ================= INIT APP =================
const app = express();

// ================= CONNECT DB =================
connectDB();

// ================= GLOBAL MIDDLEWARE =================
const allowedOrigins = [
  "https://htcoachingweb.netlify.app",
  "http://localhost:5173",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  }),
);

app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

// ================= RATE LIMIT =================
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: "Quá nhiều yêu cầu, vui lòng thử lại sau 15 phút",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: "Quá nhiều lần thử, vui lòng thử lại sau 15 phút",
  },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: {
    success: false,
    message: "Quá nhiều yêu cầu, vui lòng thử lại sau",
  },
});

const isProd = process.env.NODE_ENV === "production";

if (isProd) {
  app.use("/api", globalLimiter);
  app.use("/api/auth", authLimiter);
  app.use("/api/orders", apiLimiter);
  app.use("/api/checkin", apiLimiter);
}

// ================= CSRF TOKEN GENERATE =================
app.use((req, res, next) => {
  if (!req.cookies.csrfToken) {
    const newToken = generateCsrfToken();
    res.cookie("csrfToken", newToken, {
      httpOnly: false,
      secure: isProd,
      sameSite: isProd ? "strict" : "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });
  }
  next();
});

// ================= CSRF PROTECTION =================
app.use("/api/orders", csrfProtection);
app.use("/api/checkin", csrfProtection);
app.use("/api/user", csrfProtection);
app.use("/api/auth/logout", csrfProtection);

// ================= ROUTES =================
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/checkin", checkinRoutes);

// ================= ERROR HANDLER =================
app.use(errorHandler);

// ================= START SERVER =================
app.listen(process.env.PORT, () => {
  console.log(`🚀 Server chạy tại port ${process.env.PORT}`);
});
