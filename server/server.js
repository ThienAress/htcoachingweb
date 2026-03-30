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
import contactRoutes from "./src/routes/contact.routes.js";

import { generateCsrfToken, csrfProtection } from "./src/middlewares/csrf.js";
import { errorHandler } from "./src/middlewares/errorHandler.js";

// ================= INIT APP =================
const app = express();

// ================= proxy =================
app.set("trust proxy", 1);

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
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  }),
);

app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

// ================= RATE LIMIT =================
const isProd = process.env.NODE_ENV === "production";

if (isProd) {
  app.use("/api", globalLimiter);
  app.use("/api/auth", authLimiter);
  app.use("/api/orders", apiLimiter);
  app.use("/api/checkin", apiLimiter);
  app.use("/api/contact", contactLimiter, contactRoutes);
}

// ================= CSRF TOKEN GENERATE =================
app.use((req, res, next) => {
  if (!req.cookies.csrfToken) {
    const newToken = generateCsrfToken();
    res.cookie("csrfToken", newToken, {
      httpOnly: false,
      secure: true, // luôn true vì production HTTPS
      sameSite: "none", // quan trọng: cho phép cross-site
      path: "/",
      maxAge: 24 * 60 * 60 * 1000,
    });
  }
  next();
});

// ================= CSRF PROTECTION =================
// app.use("/api/orders", csrfProtection);
// app.use("/api/checkin", csrfProtection);
// app.use("/api/user", csrfProtection);
// app.use("/api/auth/logout", csrfProtection);

// ================= ROUTES =================
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/checkin", checkinRoutes);
app.use("/api/contact", contactRoutes);

// ================= ERROR HANDLER =================
app.use(errorHandler);

// ================= START SERVER =================
app.listen(process.env.PORT, () => {
  console.log(`🚀 Server chạy tại port ${process.env.PORT}`);
});
