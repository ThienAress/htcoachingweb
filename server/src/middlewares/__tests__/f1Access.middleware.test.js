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
import TrainerSubscription from "../../models/TrainerSubscription.js";
import {
  protect,
  requireTrainerAccess,
} from "../f1Access.middleware.js";

let app;

const addSubscription = async (userId, planCode, planTitle) =>
  TrainerSubscription.create({
    userId,
    planCode,
    planTitle,
    billingCycle: "month",
    amount: 0,
    startDate: new Date(),
    endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    status: "active",
    source: "admin_grant",
  });

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.get("/f1", protect, requireTrainerAccess, (_req, res) => {
    res.status(200).json({ success: true });
  });
});

afterEach(clearCollections);
afterAll(teardownTestDB);

describe("F1 CRM & AI entitlement", () => {
  it("chặn Free và Tiêu chuẩn dù vẫn có Trainer access", async () => {
    for (const [planCode, planTitle] of [
      ["free", "Free"],
      ["standard", "Tiêu chuẩn"],
    ]) {
      const actor = await createTestUser({
        email: `${planCode}@example.com`,
      });
      await addSubscription(actor.user._id, planCode, planTitle);

      const response = await withAuth(
        request(app).get("/f1"),
        actor.accessToken,
      );
      expect(response.status).toBe(403);
      expect(response.body.code).toBe("TRAINER_ENTITLEMENT_REQUIRED");
      await clearCollections();
    }
  });

  it("cho phép Chuyên nghiệp và Cao cấp", async () => {
    for (const [planCode, planTitle] of [
      ["professional", "Chuyên nghiệp"],
      ["premium", "Cao cấp"],
    ]) {
      const actor = await createTestUser({
        email: `${planCode}@example.com`,
      });
      await addSubscription(actor.user._id, planCode, planTitle);

      const response = await withAuth(
        request(app).get("/f1"),
        actor.accessToken,
      );
      expect(response.status).toBe(200);
      await clearCollections();
    }
  });

  it("giữ quyền truy cập cho admin và trainer legacy", async () => {
    for (const role of ["admin", "trainer"]) {
      const actor = await createTestUser({
        email: `${role}@example.com`,
        role,
      });
      const response = await withAuth(
        request(app).get("/f1"),
        actor.accessToken,
      );
      expect(response.status).toBe(200);
      await clearCollections();
    }
  });
});
