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

let app;

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.get("/api/deposits/policy", protect, getDepositPolicy);
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
      minAmount: 5000,
      maxAmount: 100000000,
    });
  });

  it("requires authentication", async () => {
    const response = await request(app).get("/api/deposits/policy");
    expect(response.status).toBe(401);
  });
});
