import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

import {
  setupTestDB,
  teardownTestDB,
  clearCollections,
  createTestUser,
  createTestApp,
  withAuth,
  TEST_JWT_SECRET,
} from "../../__tests__/setup.js";

import { protect, requireRoles } from "../auth.middleware.js";

// =============================================================================
// Integration Test: Auth Middleware
// Test trực tiếp middleware với Express app + MongoDB in-memory
// =============================================================================

let app;

beforeAll(async () => {
  await setupTestDB();

  app = createTestApp();

  // Mount test route protected by middleware
  app.get("/test/protected", protect, (req, res) => {
    res.json({ success: true, user: req.user });
  });

  app.get(
    "/test/admin-only",
    protect,
    requireRoles("admin"),
    (req, res) => {
      res.json({ success: true, message: "Admin access" });
    }
  );

  app.get(
    "/test/trainer-or-admin",
    protect,
    requireRoles("admin", "trainer"),
    (req, res) => {
      res.json({ success: true, message: "Trainer/Admin access" });
    }
  );
});

afterEach(async () => {
  await clearCollections();
});

afterAll(async () => {
  await teardownTestDB();
});

describe("protect middleware", () => {
  it("cho phép request với valid JWT → set req.user", async () => {
    const { accessToken } = await createTestUser({ role: "user" });

    const res = await request(app)
      .get("/test/protected")
      .set("Cookie", [`accessToken=${accessToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.role).toBe("user");
  });

  it("trả 401 khi không có accessToken cookie", async () => {
    const res = await request(app).get("/test/protected");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Không có token");
  });

  it("trả 401 khi JWT đã hết hạn", async () => {
    const { user } = await createTestUser();

    const expiredToken = jwt.sign(
      { id: user._id, role: user.role },
      TEST_JWT_SECRET,
      { expiresIn: "0s" } // Hết hạn ngay lập tức
    );

    const res = await request(app)
      .get("/test/protected")
      .set("Cookie", [`accessToken=${expiredToken}`]);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Token không hợp lệ");
  });

  it("trả 401 khi JWT bị giả mạo (sai secret)", async () => {
    const fakeToken = jwt.sign(
      { id: "fake-id", role: "admin" },
      "wrong-secret-key",
      { expiresIn: "15m" }
    );

    const res = await request(app)
      .get("/test/protected")
      .set("Cookie", [`accessToken=${fakeToken}`]);

    expect(res.status).toBe(401);
  });

  it("trả 401 khi user không tồn tại trong DB", async () => {
    // Tạo token với ID không tồn tại
    const fakeUserId = "507f1f77bcf86cd799439011";
    const tokenForGhost = jwt.sign(
      { id: fakeUserId, role: "user" },
      TEST_JWT_SECRET,
      { expiresIn: "15m" }
    );

    const res = await request(app)
      .get("/test/protected")
      .set("Cookie", [`accessToken=${tokenForGhost}`]);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Tài khoản không tồn tại");
  });
});

describe("requireRoles middleware", () => {
  it("admin truy cập được route admin-only", async () => {
    const { accessToken } = await createTestUser({ role: "admin" });

    const res = await request(app)
      .get("/test/admin-only")
      .set("Cookie", [`accessToken=${accessToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Admin access");
  });

  it("user bị chặn khỏi route admin-only → 403", async () => {
    const { accessToken } = await createTestUser({ role: "user" });

    const res = await request(app)
      .get("/test/admin-only")
      .set("Cookie", [`accessToken=${accessToken}`]);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Không có quyền");
  });

  it("trainer bị chặn khỏi route admin-only → 403", async () => {
    const { accessToken } = await createTestUser({ role: "trainer" });

    const res = await request(app)
      .get("/test/admin-only")
      .set("Cookie", [`accessToken=${accessToken}`]);

    expect(res.status).toBe(403);
  });

  it("trainer truy cập được route trainer-or-admin", async () => {
    const { accessToken } = await createTestUser({ role: "trainer" });

    const res = await request(app)
      .get("/test/trainer-or-admin")
      .set("Cookie", [`accessToken=${accessToken}`]);

    expect(res.status).toBe(200);
  });

  it("user bị chặn khỏi route trainer-or-admin → 403", async () => {
    const { accessToken } = await createTestUser({ role: "user" });

    const res = await request(app)
      .get("/test/trainer-or-admin")
      .set("Cookie", [`accessToken=${accessToken}`]);

    expect(res.status).toBe(403);
  });
});
