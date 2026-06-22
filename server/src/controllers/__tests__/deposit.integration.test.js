import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import request from "supertest";

import {
  setupTestDB,
  teardownTestDB,
  clearCollections,
  createTestUser,
  createTestApp,
  withAuth,
} from "../../__tests__/setup.js";

import { protect } from "../../middlewares/auth.middleware.js";
import { csrfProtection } from "../../middlewares/csrf.js";
import {
  createDeposit,
  getMyDeposits,
  getDepositById,
  getMyWallet,
  confirmDeposit,
} from "../deposit.controller.js";

import DepositRequest from "../../models/DepositRequest.js";
import Wallet from "../../models/Wallet.js";

// =============================================================================
// Integration Test: Deposit API (luồng nạp tiền)
// Test với MongoDB in-memory — verify toàn bộ data flow
// =============================================================================

let app;

beforeAll(async () => {
  await setupTestDB();

  app = createTestApp();

  // Mount deposit routes giống server.js
  app.post("/api/deposits", protect, csrfProtection, createDeposit);
  app.get("/api/deposits", protect, getMyDeposits);
  app.get("/api/deposits/:id", protect, getDepositById);
  app.post("/api/deposits/:id/confirm", protect, csrfProtection, confirmDeposit);
  app.get("/api/me/wallet", protect, getMyWallet);
});

afterEach(async () => {
  await clearCollections();
});

afterAll(async () => {
  await teardownTestDB();
});

describe("POST /api/deposits — Tạo yêu cầu nạp tiền", () => {
  it("tạo deposit thành công với amount hợp lệ", async () => {
    const { accessToken } = await createTestUser();

    const res = await withAuth(
      request(app).post("/api/deposits").send({ amount: 100000 }),
      accessToken
    );

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.amount).toBe(100000);
    expect(res.body.data.depositCode).toMatch(/^HTC-/);
    expect(res.body.data.status).toBe("pending");
    expect(res.body.data.qrPayload).toBeDefined();
    expect(res.body.data.expiresAt).toBeDefined();
  });

  it("trả 400 khi amount < 5000 (tối thiểu)", async () => {
    const { accessToken } = await createTestUser();

    const res = await withAuth(
      request(app).post("/api/deposits").send({ amount: 1000 }),
      accessToken
    );

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("5.000");
  });

  it("trả 400 khi amount > 100.000.000 (tối đa)", async () => {
    const { accessToken } = await createTestUser();

    const res = await withAuth(
      request(app).post("/api/deposits").send({ amount: 200000000 }),
      accessToken
    );

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("100.000.000");
  });

  it("trả 400 khi không có amount", async () => {
    const { accessToken } = await createTestUser();

    const res = await withAuth(
      request(app).post("/api/deposits").send({}),
      accessToken
    );

    expect(res.status).toBe(400);
  });

  it("trả về QR cũ nếu đã có pending deposit chưa hết hạn", async () => {
    const { accessToken, user } = await createTestUser();

    // Tạo deposit đầu tiên
    const res1 = await withAuth(
      request(app).post("/api/deposits").send({ amount: 50000 }),
      accessToken
    );
    expect(res1.status).toBe(201);

    // Tạo deposit thứ 2 → phải trả lại QR cũ
    const res2 = await withAuth(
      request(app).post("/api/deposits").send({ amount: 100000 }),
      accessToken
    );

    expect(res2.status).toBe(200);
    expect(res2.body.message).toContain("chưa hết hạn");
    // Amount phải là của deposit cũ (50000), không phải 100000
    expect(res2.body.data.amount).toBe(50000);
  });

  it("chặn khi đã có deposit needs_review", async () => {
    const { accessToken, user } = await createTestUser();

    // Tạo deposit
    const res1 = await withAuth(
      request(app).post("/api/deposits").send({ amount: 50000 }),
      accessToken
    );

    // Confirm → chuyển sang needs_review
    await withAuth(
      request(app).post(`/api/deposits/${res1.body.data.depositRequestId}/confirm`).send(),
      accessToken
    );

    // Thử tạo deposit mới → phải bị chặn
    const res3 = await withAuth(
      request(app).post("/api/deposits").send({ amount: 100000 }),
      accessToken
    );

    expect(res3.status).toBe(400);
    expect(res3.body.message).toContain("chờ admin duyệt");
  });

  it("tự tạo wallet nếu user chưa có", async () => {
    const { accessToken, user } = await createTestUser();

    // Trước khi tạo deposit — user chưa có wallet
    const walletBefore = await Wallet.findOne({ userId: user._id });
    expect(walletBefore).toBeNull();

    // Tạo deposit
    await withAuth(
      request(app).post("/api/deposits").send({ amount: 50000 }),
      accessToken
    );

    // Sau khi tạo — wallet phải được tạo tự động
    const walletAfter = await Wallet.findOne({ userId: user._id });
    expect(walletAfter).not.toBeNull();
    expect(walletAfter.balance).toBe(0);
  });

  it("trả 401 khi không có auth token", async () => {
    const res = await request(app)
      .post("/api/deposits")
      .send({ amount: 50000 });

    expect(res.status).toBe(401);
  });
});

describe("POST /api/deposits/:id/confirm — Xác nhận thanh toán", () => {
  it("chuyển status từ pending → needs_review", async () => {
    const { accessToken } = await createTestUser();

    // Tạo deposit
    const createRes = await withAuth(
      request(app).post("/api/deposits").send({ amount: 50000 }),
      accessToken
    );
    const depositId = createRes.body.data.depositRequestId;

    // Confirm
    const confirmRes = await withAuth(
      request(app).post(`/api/deposits/${depositId}/confirm`).send(),
      accessToken
    );

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.status).toBe("needs_review");
  });

  it("trả 400 khi deposit không ở trạng thái pending", async () => {
    const { accessToken } = await createTestUser();

    // Tạo + confirm deposit
    const createRes = await withAuth(
      request(app).post("/api/deposits").send({ amount: 50000 }),
      accessToken
    );
    const depositId = createRes.body.data.depositRequestId;

    await withAuth(
      request(app).post(`/api/deposits/${depositId}/confirm`).send(),
      accessToken
    );

    // Confirm lần 2 → phải lỗi
    const res = await withAuth(
      request(app).post(`/api/deposits/${depositId}/confirm`).send(),
      accessToken
    );

    expect(res.status).toBe(400);
  });
});

describe("GET /api/deposits — Lịch sử nạp tiền", () => {
  it("trả về danh sách deposits của user", async () => {
    const { accessToken } = await createTestUser();

    // Tạo 1 deposit
    await withAuth(
      request(app).post("/api/deposits").send({ amount: 50000 }),
      accessToken
    );

    const res = await request(app)
      .get("/api/deposits")
      .set("Cookie", [`accessToken=${accessToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].amount).toBe(50000);
  });

  it("user A không thấy deposits của user B", async () => {
    const userA = await createTestUser({ email: "a@test.com" });
    const userB = await createTestUser({ email: "b@test.com" });

    // User A tạo deposit
    await withAuth(
      request(app).post("/api/deposits").send({ amount: 50000 }),
      userA.accessToken
    );

    // User B xem → phải rỗng
    const res = await request(app)
      .get("/api/deposits")
      .set("Cookie", [`accessToken=${userB.accessToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

describe("GET /api/me/wallet — Xem số dư ví", () => {
  it("trả về wallet với balance = 0 cho user mới", async () => {
    const { accessToken } = await createTestUser();

    const res = await request(app)
      .get("/api/me/wallet")
      .set("Cookie", [`accessToken=${accessToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.data.balance).toBe(0);
    expect(res.body.data.currency).toBe("VND");
  });

  it("tự tạo wallet nếu chưa có", async () => {
    const { accessToken, user } = await createTestUser();

    // Chưa có wallet
    const before = await Wallet.findOne({ userId: user._id });
    expect(before).toBeNull();

    // Gọi API
    await request(app)
      .get("/api/me/wallet")
      .set("Cookie", [`accessToken=${accessToken}`]);

    // Wallet đã được tạo
    const after = await Wallet.findOne({ userId: user._id });
    expect(after).not.toBeNull();
  });
});
