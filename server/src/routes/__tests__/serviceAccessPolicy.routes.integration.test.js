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
import serviceAccessPolicyRoutes from "../serviceAccessPolicy.routes.js";

let app;

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/admin/service-access-policies", serviceAccessPolicyRoutes);
});

afterEach(clearCollections);
afterAll(teardownTestDB);

describe("GET /api/admin/service-access-policies", () => {
  it("returns the canonical read-only matrix to admin", async () => {
    const { accessToken } = await createTestUser({
      email: "policy-admin@example.com",
      role: "admin",
    });

    const response = await withAuth(
      request(app).get("/api/admin/service-access-policies"),
      accessToken,
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.columns).toEqual([
      expect.objectContaining({ id: "guest", label: "Guest" }),
      expect.objectContaining({ id: "user", label: "User thường" }),
      expect.objectContaining({
        id: "paid",
        label: "User có gói / HLV",
      }),
    ]);
    expect(response.body.data.services).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          serviceKey: "meal_scan",
          policies: expect.objectContaining({
            guest: expect.objectContaining({ limit: 2 }),
            user: expect.objectContaining({ limit: 3 }),
            coaching_customer: expect.objectContaining({ limit: 10 }),
            trainer: expect.objectContaining({ limit: 10 }),
          }),
        }),
      ]),
    );
    expect(response.body.data.trainerPlans.columns.map((plan) => plan.id)).toEqual([
      "free",
      "standard",
      "professional",
      "premium",
    ]);
    expect(response.body.data.trainerPlans.benefits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "max_students",
          values: { free: 3, standard: 5, professional: 20, premium: 50 },
        }),
        expect.objectContaining({
          key: "crm_ai_analysis",
          values: {
            free: false,
            standard: false,
            professional: true,
            premium: true,
          },
        }),
      ]),
    );
  });

  it("rejects non-admin users", async () => {
    const { accessToken } = await createTestUser({
      email: "policy-user@example.com",
      role: "user",
    });

    const response = await withAuth(
      request(app).get("/api/admin/service-access-policies"),
      accessToken,
    );

    expect(response.status).toBe(403);
  });
});
