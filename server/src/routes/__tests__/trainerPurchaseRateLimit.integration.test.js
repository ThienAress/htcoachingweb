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
import trainerSubscriptionRoutes from "../trainerSubscription.routes.js";

// Mua gói HLV trừ tiền trong ví nên phải có cùng chốt chặn tốc độ (financialCommandLimiter: 30 lệnh/15 phút/IP)
// như mua gói HT Fitness+ và các lệnh nạp tiền của admin. Dữ liệu cố ý sai (400) để không tạo giao dịch nào.
let app;

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/trainer-subscriptions", trainerSubscriptionRoutes);
});
afterEach(clearCollections);
afterAll(teardownTestDB);

const purchase = (path, token) => withAuth(request(app).post(path).send({}), token);

describe("trainer plan purchase rate limit", () => {
  it("stops the 31st purchase command from one address, whichever path it uses", async () => {
    const actor = await createTestUser({ email: "trainer-purchase-limit@example.com" });

    const statuses = [];
    for (let index = 0; index < 30; index += 1) {
      const response = await purchase(index % 2 === 0 ? "/api/trainer-subscriptions" : "/api/trainer-subscriptions/purchase", actor.accessToken);
      statuses.push(response.status);
    }
    const blocked = await purchase("/api/trainer-subscriptions", actor.accessToken);

    expect(statuses.every((status) => status === 400)).toBe(true);
    expect(blocked.status).toBe(429);
    expect(blocked.body.success).toBe(false);
  });
});
