import request from "supertest";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import adminDepositRoutes from "../../routes/adminDeposit.routes.js";
import WalletTransaction from "../../models/WalletTransaction.js";

describe("Admin incoming bank transaction security boundary", () => {
  let app;

  beforeAll(async () => {
    await setupTestDB();
    app = createTestApp();
    app.use("/api/admin/deposits", adminDepositRoutes);
  });
  afterEach(clearCollections);
  afterAll(teardownTestDB);

  it("rejects a financial mutation when the CSRF proof is missing", async () => {
    const admin = await createTestUser({
      email: "incoming-csrf-admin@example.com",
      role: "admin",
    });
    const response = await request(app)
      .post("/api/admin/deposits/incoming/507f1f77bcf86cd799439011/ignore")
      .set("Cookie", [`accessToken=${admin.accessToken}`])
      .send({ reason: "Không thuộc giao dịch nạp tiền" });

    expect({
      status: response.status,
      ledgerCount: await WalletTransaction.countDocuments(),
    }).toEqual({ status: 403, ledgerCount: 0 });
  });

  it("rejects malformed ids and short reasons before a ledger write", async () => {
    const admin = await createTestUser({
      email: "incoming-validation-admin@example.com",
      role: "admin",
    });
    const response = await withAuth(
      request(app)
        .post("/api/admin/deposits/incoming/not-an-object-id/ignore")
        .send({ reason: "ngắn" }),
      admin.accessToken,
    );

    expect({
      status: response.status,
      ledgerCount: await WalletTransaction.countDocuments(),
    }).toEqual({ status: 400, ledgerCount: 0 });
  });
});
