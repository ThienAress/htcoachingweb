import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import trainerTransferRoutes from "../trainerTransfer.routes.js";

describe("trainer coordination route authorization", () => {
  let app;

  beforeAll(async () => {
    await setupTestDB();
    app = createTestApp();
    app.use("/api/admin/trainer-coordination", trainerTransferRoutes);
  });
  afterEach(clearCollections);
  afterAll(teardownTestDB);

  it("keeps all trainer coordination read models admin-only", async () => {
    const admin = await createTestUser({ role: "admin", email: "route-admin@example.com" });
    const trainer = await createTestUser({ role: "trainer", email: "route-trainer@example.com" });

    const [adminResponse, trainerResponse] = await Promise.all([
      withAuth(
        request(app).get("/api/admin/trainer-coordination/orders/recent"),
        admin.accessToken,
      ),
      withAuth(
        request(app).get("/api/admin/trainer-coordination/orders/recent"),
        trainer.accessToken,
      ),
    ]);

    expect([adminResponse.status, trainerResponse.status]).toEqual([200, 403]);
  });
});
