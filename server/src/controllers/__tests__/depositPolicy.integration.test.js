import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import request from "supertest";

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import { getDepositPolicy } from "../depositPolicy.controller.js";
import { protect } from "../../middlewares/auth.middleware.js";
import adminDepositRoutes from "../../routes/adminDeposit.routes.js";
import AuditLog from "../../models/AuditLog.js";
import DepositPolicy from "../../models/DepositPolicy.js";
import DepositRequest from "../../models/DepositRequest.js";

let app;

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.get("/api/deposits/policy", protect, getDepositPolicy);
  app.use("/api/admin/deposits", adminDepositRoutes);
});

afterEach(async () => {
  await clearCollections();
});

afterAll(async () => {
  await teardownTestDB();
});

describe("GET /api/deposits/policy", () => {
  it("returns the server-authoritative VND boundaries", async () => {
    const actor = await createTestUser({
      email: "deposit-policy@example.com",
    });

    const response = await withAuth(
      request(app).get("/api/deposits/policy"),
      actor.accessToken,
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      currency: "VND",
      minAmount: 10000,
      maxAmount: 1000000000,
      policyVersion: 1,
      tiers: [
        { key: "starter", minAmount: 10000, bonusRate: 10 },
        { key: "growth", minAmount: 100000, bonusRate: 15 },
        { key: "premium", minAmount: 200000, bonusRate: 20 },
      ],
    });
  });

  it("requires authentication", async () => {
    const response = await request(app).get("/api/deposits/policy");
    expect(response.status).toBe(401);
  });
});

describe("PUT /api/admin/deposits/policy", () => {
  const rates = { starter: 5, growth: 16, premium: 25 };

  it("updates all rates atomically, increments version and writes one audit", async () => {
    const admin = await createTestUser({
      email: "deposit-policy-admin@example.com",
      role: "admin",
    });

    const response = await withAuth(
      request(app).put("/api/admin/deposits/policy").send({ rates }),
      admin.accessToken,
    );

    expect(response.status).toBe(200);
    expect(response.body.changed).toBe(true);
    expect(response.body.data).toMatchObject({
      policyVersion: 2,
      tiers: [
        { key: "starter", bonusRate: 5 },
        { key: "growth", bonusRate: 16 },
        { key: "premium", bonusRate: 25 },
      ],
    });
    expect(await DepositPolicy.countDocuments()).toBe(1);
    expect(
      await AuditLog.countDocuments({ action: "update_deposit_policy" }),
    ).toBe(1);
  });

  it("does not increment version or audit a no-op update", async () => {
    const admin = await createTestUser({
      email: "deposit-policy-noop@example.com",
      role: "admin",
    });
    const requestUpdate = () =>
      withAuth(
        request(app).put("/api/admin/deposits/policy").send({ rates }),
        admin.accessToken,
      );

    await requestUpdate();
    const response = await requestUpdate();

    expect(response.body).toMatchObject({ changed: false });
    expect(response.body.data.policyVersion).toBe(2);
    expect(
      await AuditLog.countDocuments({ action: "update_deposit_policy" }),
    ).toBe(1);
  });

  it("serializes concurrent first writes through the deterministic singleton id", async () => {
    const admin = await createTestUser({
      email: "deposit-policy-concurrent@example.com",
      role: "admin",
    });

    const responses = await Promise.all([
      withAuth(
        request(app).put("/api/admin/deposits/policy").send({ rates }),
        admin.accessToken,
      ),
      withAuth(
        request(app).put("/api/admin/deposits/policy").send({ rates }),
        admin.accessToken,
      ),
    ]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(responses.filter((response) => response.body.changed)).toHaveLength(1);
    expect(await DepositPolicy.countDocuments()).toBe(1);
    expect(
      await AuditLog.countDocuments({ action: "update_deposit_policy" }),
    ).toBe(1);
  });

  it("rejects malformed, out-of-range and decreasing rates before writing", async () => {
    const admin = await createTestUser({
      email: "deposit-policy-invalid@example.com",
      role: "admin",
    });
    const payloads = [
      { starter: 5, growth: 16 },
      { starter: 5, growth: 16, premium: 25, extra: 30 },
      { starter: "5", growth: 16, premium: 25 },
      { starter: 5.5, growth: 16, premium: 25 },
      { starter: -1, growth: 16, premium: 25 },
      { starter: 5, growth: 16, premium: 101 },
      { starter: 20, growth: 15, premium: 25 },
    ];

    for (const invalidRates of payloads) {
      const response = await withAuth(
        request(app)
          .put("/api/admin/deposits/policy")
          .send({ rates: invalidRates }),
        admin.accessToken,
      );
      expect(response.status).toBe(400);
    }
    expect(await DepositPolicy.countDocuments()).toBe(0);
    expect(await AuditLog.countDocuments()).toBe(0);
  });

  it("requires auth, admin role and CSRF", async () => {
    const user = await createTestUser({
      email: "deposit-policy-user@example.com",
    });
    const admin = await createTestUser({
      email: "deposit-policy-csrf-admin@example.com",
      role: "admin",
    });
    const unauthenticated = await request(app)
      .put("/api/admin/deposits/policy")
      .send({ rates });
    const forbidden = await withAuth(
      request(app).put("/api/admin/deposits/policy").send({ rates }),
      user.accessToken,
    );
    const csrfRejected = await request(app)
      .put("/api/admin/deposits/policy")
      .set("Cookie", [`accessToken=${admin.accessToken}`])
      .send({ rates });

    expect(unauthenticated.status).toBe(401);
    expect(forbidden.status).toBe(403);
    expect(csrfRejected.status).toBe(403);
  });
});

describe("GET /api/admin/deposits legacy snapshot DTO", () => {
  it("returns a zero-bonus fallback without exposing the internal legacy flag", async () => {
    const customer = await createTestUser({
      email: "deposit-policy-legacy-customer@example.com",
    });
    const admin = await createTestUser({
      email: "deposit-policy-legacy-admin@example.com",
      role: "admin",
    });
    await DepositRequest.create({
      userId: customer.user._id,
      amount: 5000,
      depositCode: "HTC-OLD2-0002",
      expiresAt: new Date(Date.now() + 60_000),
      status: "pending",
    });

    const response = await withAuth(
      request(app).get("/api/admin/deposits"),
      admin.accessToken,
    );

    expect(response.body.data[0]).toMatchObject({
      amount: 5000,
      bonusRate: 0,
      bonusAmount: 0,
      creditedAmount: 5000,
      bonusTierKey: null,
      policyVersion: null,
    });
    expect(response.body.data[0]).not.toHaveProperty("legacy");
  });
});
