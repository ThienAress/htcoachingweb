import mongoose from "mongoose";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import F1AiRule from "../../models/F1AiRule.js";
import Gym from "../../models/Gym.js";
import f1AiRuleRoutes from "../f1AiRule.routes.js";
import gymRoutes from "../gym.routes.js";

describe("Admin write endpoints only accept business fields", () => {
  let app;
  let admin;
  let adminToken;

  beforeAll(async () => {
    await setupTestDB();
    app = createTestApp();
    app.use("/api/f1-ai-rules", f1AiRuleRoutes);
    app.use("/api/gyms", gymRoutes);
    await Promise.all([F1AiRule.init(), Gym.init()]);
  });

  beforeEach(async () => {
    ({ user: admin, accessToken: adminToken } = await createTestUser({
      email: "allowlist-admin@example.test",
      role: "admin",
    }));
  });

  afterEach(async () => {
    await clearCollections();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  test("F1 AI rule create and update ignore server-owned fields", async () => {
    const forgedActor = new mongoose.Types.ObjectId();
    const created = await withAuth(
      request(app).post("/api/f1-ai-rules").send({
        code: "RULE_ALLOWLIST",
        name: "Allowlist rule",
        category: "general_advice",
        recommendation: { content: "Ngủ đủ giấc" },
        createdBy: String(forgedActor),
        updatedBy: String(forgedActor),
      }),
      adminToken,
    );

    expect(created.status).toBe(201);
    expect(created.body.data.createdBy).toBe(String(admin._id));

    const updated = await withAuth(
      request(app).put(`/api/f1-ai-rules/${created.body.data._id}`).send({
        name: "Allowlist rule v2",
        createdBy: String(forgedActor),
        updatedBy: String(forgedActor),
      }),
      adminToken,
    );

    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({
      name: "Allowlist rule v2",
      createdBy: String(admin._id),
      updatedBy: String(admin._id),
    });
  });

  test("gym update keeps the image unless a file is uploaded", async () => {
    const gym = await Gym.create({
      name: "HT Gym",
      address: "1 Lê Lợi",
      district: "Quận 1",
      image: "https://res.cloudinary.com/demo/image/upload/gym.jpg",
    });

    const response = await withAuth(
      request(app).put(`/api/gyms/${gym._id}`).send({
        name: "HT Gym Center",
        image: "https://attacker.example/evil.png",
      }),
      adminToken,
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      name: "HT Gym Center",
      image: "https://res.cloudinary.com/demo/image/upload/gym.jpg",
    });
  });
});
