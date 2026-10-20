import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
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
import Wallet from "../../models/Wallet.js";
import {
  createDepositCreditSnapshot,
  getCurrentDepositPolicy,
} from "../../services/depositPolicy.service.js";

let app;

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.get("/api/deposits/policy", protect, getDepositPolicy);
  app.use("/api/admin/deposits", adminDepositRoutes);
});
afterEach(clearCollections);
afterAll(teardownTestDB);

const rates = { starter: 10, growth: 15, premium: 20 };
const createCustomer = async (suffix) => {
  const customer = await createTestUser({ email: `tier-${suffix}-customer@example.com` });
  await Wallet.create({ userId: customer.user._id });
  return customer;
};
const createAdmin = (suffix) =>
  createTestUser({ email: `tier-admin-${suffix}@example.com`, role: "admin" });

const savePolicy = (token, body) =>
  withAuth(request(app).put("/api/admin/deposits/policy").send(body), token);

const approve = (token, id) =>
  withAuth(request(app).post(`/api/admin/deposits/${id}/approve`).send({}), token);

// Hóa đơn tạo theo chính sách hiện hành, giống lúc khách bấm nạp.
const createPendingDeposit = async (userId, amount, code) => {
  const snapshot = createDepositCreditSnapshot(await getCurrentDepositPolicy(), amount);
  return DepositRequest.create({
    userId,
    amount,
    depositCode: code,
    expiresAt: new Date(Date.now() + 60_000),
    status: "pending",
    isOpen: true,
    ...snapshot,
  });
};

describe("deposit tier thresholds and labels", () => {
  it("serves the default thresholds with no label until an admin sets one", async () => {
    const user = await createTestUser({ email: "tier-default@example.com" });

    const response = await withAuth(request(app).get("/api/deposits/policy"), user.accessToken);

    expect(response.body.data.tiers).toEqual([
      { key: "starter", minAmount: 10000, bonusRate: 10, label: null },
      { key: "growth", minAmount: 100000, bonusRate: 15, label: null },
      { key: "premium", minAmount: 200000, bonusRate: 20, label: null },
    ]);
  });

  it("saves thresholds and labels with the rates, bumps the version and audits once", async () => {
    const admin = await createAdmin("save");

    const response = await savePolicy(admin.accessToken, {
      rates,
      thresholds: { growth: 150000, premium: 500000 },
      labels: { starter: "  Khởi đầu ", growth: "", premium: "Cao cấp" },
    });

    expect(response.status).toBe(200);
    expect(response.body.changed).toBe(true);
    expect(response.body.data.policyVersion).toBe(2);
    expect(response.body.data.tiers).toEqual([
      { key: "starter", minAmount: 10000, bonusRate: 10, label: "Khởi đầu" },
      { key: "growth", minAmount: 150000, bonusRate: 15, label: null },
      { key: "premium", minAmount: 500000, bonusRate: 20, label: "Cao cấp" },
    ]);
    expect(await AuditLog.countDocuments({ action: "update_deposit_policy" })).toBe(1);
  });

  it("keeps the saved thresholds and labels when a later update sends only rates", async () => {
    const admin = await createAdmin("keep");
    await savePolicy(admin.accessToken, {
      rates,
      thresholds: { growth: 150000, premium: 500000 },
      labels: { premium: "Cao cấp" },
    });

    const response = await savePolicy(admin.accessToken, { rates: { ...rates, premium: 25 } });

    expect(response.status).toBe(200);
    expect(response.body.data.tiers[1].minAmount).toBe(150000);
    expect(response.body.data.tiers[2]).toMatchObject({ minAmount: 500000, bonusRate: 25, label: "Cao cấp" });
  });

  it("treats an unchanged policy as a no-op", async () => {
    const admin = await createAdmin("noop");
    const body = { rates, thresholds: { growth: 100000, premium: 200000 }, labels: {} };

    const response = await savePolicy(admin.accessToken, body);

    expect(response.body.changed).toBe(false);
    expect(await DepositPolicy.countDocuments()).toBe(0);
    expect(await AuditLog.countDocuments()).toBe(0);
  });

  it("reads a policy saved before thresholds existed as the default thresholds", async () => {
    await DepositPolicy.collection.insertOne({
      _id: (await import("mongoose")).default.Types.ObjectId.createFromHexString(
        "00000000000000000000d091",
      ),
      policyKey: "wallet_deposit_bonus",
      policyVersion: 3,
      rates: { starter: 5, growth: 16, premium: 25 },
    });

    const policy = await getCurrentDepositPolicy();

    expect(policy.policyVersion).toBe(3);
    expect(policy.tiers.map((tier) => tier.minAmount)).toEqual([10000, 100000, 200000]);
  });

  it("rejects thresholds and labels that could break the ladder, without writing", async () => {
    const admin = await createAdmin("invalid");
    const bad = [
      { thresholds: { growth: 5000, premium: 200000 } },
      { thresholds: { growth: 200000, premium: 200000 } },
      { thresholds: { growth: 150000, premium: 2_000_000_000 } },
      { thresholds: { growth: 150500, premium: 300000 } },
      { thresholds: { growth: "150000", premium: 300000 } },
      { thresholds: { growth: 150000 } },
      { thresholds: { starter: 20000, growth: 150000, premium: 300000 } },
      { labels: { starter: "x".repeat(41) } },
      { labels: { gold: "Vàng" } },
      { labels: { starter: 5 } },
      { labels: { starter: "a\u0007b" } },
    ];

    for (const extra of bad) {
      const response = await savePolicy(admin.accessToken, { rates, ...extra });
      expect(response.status, JSON.stringify(extra)).toBe(400);
    }
    expect(await DepositPolicy.countDocuments()).toBe(0);
    expect(await AuditLog.countDocuments()).toBe(0);
  });
});

describe("deposits created before a threshold change", () => {
  it("still credit the tier they were created with once an admin moves the thresholds", async () => {
    const admin = await createAdmin("pending");
    const customer = await createCustomer("pending");
    const pending = await createPendingDeposit(customer.user._id, 150000, "HTC-TIER-0001");
    expect(pending.bonusTierKey).toBe("growth");
    expect(pending.bonusTierMinAmount).toBe(100000);

    await savePolicy(admin.accessToken, {
      rates,
      thresholds: { growth: 160000, premium: 500000 },
    });
    const response = await approve(admin.accessToken, pending._id);

    expect(response.status).toBe(200);
    const wallet = await Wallet.findOne({ userId: customer.user._id }).lean();
    expect(wallet.balance).toBe(172500);
  });

  it("are priced by the new thresholds when created afterwards", async () => {
    const admin = await createAdmin("after");
    const customer = await createCustomer("after");
    await savePolicy(admin.accessToken, {
      rates,
      thresholds: { growth: 160000, premium: 500000 },
    });

    const created = await createPendingDeposit(customer.user._id, 150000, "HTC-TIER-0002");

    expect(created).toMatchObject({ bonusTierKey: "starter", bonusTierMinAmount: 10000, bonusRate: 10 });
    expect((await approve(admin.accessToken, created._id)).status).toBe(200);
    expect((await Wallet.findOne({ userId: customer.user._id }).lean()).balance).toBe(165000);
  });

  it("and legacy deposits that never stored a tier minimum still settle", async () => {
    const admin = await createAdmin("legacy");
    const customer = await createCustomer("legacy");
    const legacy = await DepositRequest.create({
      userId: customer.user._id,
      amount: 150000,
      depositCode: "HTC-TIER-0003",
      expiresAt: new Date(Date.now() + 60_000),
      status: "pending",
      isOpen: true,
      bonusRate: 15,
      bonusAmount: 22500,
      creditedAmount: 172500,
      bonusTierKey: "growth",
      policyVersion: 1,
    });
    await savePolicy(admin.accessToken, {
      rates,
      thresholds: { growth: 160000, premium: 500000 },
    });

    const response = await approve(admin.accessToken, legacy._id);

    expect(response.status).toBe(200);
    expect((await Wallet.findOne({ userId: customer.user._id }).lean()).balance).toBe(172500);
  });

  it("fail closed when the stored tier minimum does not cover the amount", async () => {
    const admin = await createAdmin("tampered");
    const customer = await createCustomer("tampered");
    const tampered = await DepositRequest.create({
      userId: customer.user._id,
      amount: 50000,
      depositCode: "HTC-TIER-0004",
      expiresAt: new Date(Date.now() + 60_000),
      status: "pending",
      isOpen: true,
      bonusRate: 15,
      bonusAmount: 7500,
      creditedAmount: 57500,
      bonusTierKey: "growth",
      bonusTierMinAmount: 100000,
      policyVersion: 1,
    });

    const response = await approve(admin.accessToken, tampered._id);

    expect(response.status).toBe(409);
    expect(await Wallet.countDocuments({ userId: customer.user._id, balance: { $gt: 0 } })).toBe(0);
  });
});
