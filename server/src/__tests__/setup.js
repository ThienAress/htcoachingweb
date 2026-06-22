/**
 * Test Setup — Tạo Express app instance cho integration tests
 *
 * KHÔNG import server.js trực tiếp vì nó:
 * - Connect MongoDB thật (connectDB)
 * - Start cron jobs
 * - Listen trên port
 *
 * Thay vào đó, tạo app instance minimal chỉ với routes + middleware cần test.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

import User from "../models/User.js";

// ===== Constants =====
const TEST_JWT_SECRET = "test-jwt-secret-key-for-testing";
const TEST_REFRESH_SECRET = "test-refresh-secret-key-for-testing";

let mongoServer;

// ===== Setup & Teardown =====
export async function setupTestDB() {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  // Set env vars cho test
  process.env.JWT_SECRET = TEST_JWT_SECRET;
  process.env.REFRESH_SECRET = TEST_REFRESH_SECRET;
  process.env.NODE_ENV = "test";
}

export async function teardownTestDB() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
}

export async function clearCollections() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

// ===== Test Helpers =====

/**
 * Tạo user test trong DB + trả về JWT tokens
 */
export async function createTestUser(overrides = {}) {
  const defaults = {
    name: "Test User",
    email: `test-${Date.now()}@example.com`,
    role: "user",
    password: await bcrypt.hash("password123", 10),
  };

  const userData = { ...defaults, ...overrides };
  const user = await User.create(userData);

  const accessToken = jwt.sign(
    { id: user._id, role: user.role },
    TEST_JWT_SECRET,
    { expiresIn: "15m" }
  );

  const refreshToken = jwt.sign(
    { id: user._id },
    TEST_REFRESH_SECRET,
    { expiresIn: "7d" }
  );

  // Lưu hashed refresh token vào DB (giống auth flow thật)
  user.refreshToken = await bcrypt.hash(refreshToken, 10);
  await user.save();

  return { user, accessToken, refreshToken };
}

/**
 * Tạo Express app minimal cho testing
 * Chỉ mount routes cần thiết, không có cron jobs hay external services
 */
export function createTestApp() {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  // CSRF middleware mock — tự tạo csrfToken nếu chưa có
  app.use((req, res, next) => {
    if (!req.cookies.csrfToken) {
      res.cookie("csrfToken", "test-csrf-token");
    }
    res.setHeader("X-CSRF-Token", req.cookies.csrfToken || "test-csrf-token");
    next();
  });

  return app;
}

/**
 * Helper: set cookies cho supertest request
 * Giả lập browser gửi cookies (accessToken + csrfToken)
 */
export function withAuth(request, accessToken, csrfToken = "test-csrf-token") {
  return request
    .set("Cookie", [
      `accessToken=${accessToken}`,
      `csrfToken=${csrfToken}`,
    ])
    .set("X-CSRF-Token", csrfToken);
}

export { TEST_JWT_SECRET, TEST_REFRESH_SECRET };
