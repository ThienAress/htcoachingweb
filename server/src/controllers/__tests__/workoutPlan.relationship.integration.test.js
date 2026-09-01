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
import Order from "../../models/Order.js";
import WorkoutPlan from "../../models/WorkoutPlan.js";
import workoutPlanRoutes from "../../routes/workoutPlan.routes.js";

let app;

const sections = [{ name: "WARM UP", exercises: [] }];

const createApprovedOrder = ({ client, trainer, sessions = 8 }) =>
  Order.create({
    userId: client._id,
    trainerId: trainer._id,
    name: client.name,
    email: client.email,
    package: "ONLINE",
    sessions,
    totalSessions: 8,
    status: "approved",
    approvedAt: new Date(),
  });

const createPayload = (client) => ({
  title: "Giáo án an toàn",
  planDate: "2026-08-30",
  clientName: client.name,
  clientEmail: client.email,
  sections,
});

const createStoredPlan = ({ client, trainer, status = "draft" }) =>
  WorkoutPlan.create({
    trainerId: trainer._id,
    clientId: client._id,
    clientName: client.name,
    clientEmail: client.email,
    title: "Legacy plan",
    planDate: new Date("2026-08-30T00:00:00.000Z"),
    sections,
    status,
  });

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/workout-plans", workoutPlanRoutes);
});

afterEach(clearCollections);
afterAll(teardownTestDB);

describe("WorkoutPlan approved relationship boundary", () => {
  it("blocks creating a plan for an arbitrary registered client", async () => {
    const trainer = await createTestUser({
      role: "trainer",
      email: "workout-arbitrary-trainer@example.com",
    });
    const client = await createTestUser({
      email: "workout-arbitrary-client@example.com",
    });

    const response = await withAuth(
      request(app).post("/api/workout-plans"),
      trainer.accessToken,
    ).send(createPayload(client.user));

    expect(response.status).toBe(403);
    expect(await WorkoutPlan.countDocuments()).toBe(0);
  });

  it("blocks cross-trainer creation even when the client has active sessions", async () => {
    const owner = await createTestUser({
      role: "trainer",
      email: "workout-owner@example.com",
    });
    const outsider = await createTestUser({
      role: "trainer",
      email: "workout-outsider@example.com",
    });
    const client = await createTestUser({
      email: "workout-cross-client@example.com",
    });
    await createApprovedOrder({
      client: client.user,
      trainer: owner.user,
    });

    const response = await withAuth(
      request(app).post("/api/workout-plans"),
      outsider.accessToken,
    ).send(createPayload(client.user));

    expect(response.status).toBe(403);
  });

  it("creates a draft for the trainer-client relationship with sessions remaining", async () => {
    const trainer = await createTestUser({
      role: "trainer",
      email: "workout-valid-trainer@example.com",
    });
    const client = await createTestUser({
      email: "workout-valid-client@example.com",
    });
    await createApprovedOrder({ client: client.user, trainer: trainer.user });

    const response = await withAuth(
      request(app).post("/api/workout-plans"),
      trainer.accessToken,
    ).send(createPayload(client.user));

    expect(response.status).toBe(201);
    expect(String(response.body.data.clientId)).toBe(String(client.user._id));
    expect(String(response.body.data.trainerId)).toBe(String(trainer.user._id));
  });

  it("blocks reassigning a plan to a client outside the trainer relationship", async () => {
    const trainer = await createTestUser({
      role: "trainer",
      email: "workout-reassign-trainer@example.com",
    });
    const firstClient = await createTestUser({
      email: "workout-reassign-first@example.com",
    });
    const secondClient = await createTestUser({
      email: "workout-reassign-second@example.com",
    });
    await createApprovedOrder({
      client: firstClient.user,
      trainer: trainer.user,
    });
    const plan = await createStoredPlan({
      client: firstClient.user,
      trainer: trainer.user,
    });

    const response = await withAuth(
      request(app).put(`/api/workout-plans/${plan._id}`),
      trainer.accessToken,
    ).send({
      clientName: secondClient.user.name,
      clientEmail: secondClient.user.email,
    });

    expect(response.status).toBe(403);
    expect((await WorkoutPlan.findById(plan._id)).clientEmail).toBe(
      firstClient.user.email,
    );
  });

  it("blocks publishing a legacy draft after the order has no sessions", async () => {
    const trainer = await createTestUser({
      role: "trainer",
      email: "workout-publish-trainer@example.com",
    });
    const client = await createTestUser({
      email: "workout-publish-client@example.com",
    });
    const plan = await createStoredPlan({
      client: client.user,
      trainer: trainer.user,
    });
    await createApprovedOrder({
      client: client.user,
      trainer: trainer.user,
      sessions: 0,
    });

    const response = await withAuth(
      request(app).put(`/api/workout-plans/${plan._id}`),
      trainer.accessToken,
    ).send({ status: "published" });

    expect(response.status).toBe(403);
    expect((await WorkoutPlan.findById(plan._id)).status).toBe("draft");
  });

  it("blocks duplicating a plan when its relationship is no longer active", async () => {
    const trainer = await createTestUser({
      role: "trainer",
      email: "workout-duplicate-trainer@example.com",
    });
    const client = await createTestUser({
      email: "workout-duplicate-client@example.com",
    });
    const plan = await createStoredPlan({
      client: client.user,
      trainer: trainer.user,
    });

    const response = await withAuth(
      request(app).post(`/api/workout-plans/${plan._id}/duplicate`),
      trainer.accessToken,
    ).send({ planDate: "2026-09-01" });

    expect(response.status).toBe(403);
    expect(await WorkoutPlan.countDocuments()).toBe(1);
  });

  it("requires an approved relationship for admin creation and assigns its trainer", async () => {
    const admin = await createTestUser({
      role: "admin",
      email: "workout-admin@example.com",
    });
    const trainer = await createTestUser({
      role: "trainer",
      email: "workout-admin-target-trainer@example.com",
    });
    const client = await createTestUser({
      email: "workout-admin-client@example.com",
    });
    await createApprovedOrder({ client: client.user, trainer: trainer.user });

    const response = await withAuth(
      request(app).post("/api/workout-plans"),
      admin.accessToken,
    ).send(createPayload(client.user));

    expect(response.status).toBe(201);
    expect(String(response.body.data.trainerId)).toBe(String(trainer.user._id));
  });

  it("does not expose a client draft by id before it is published", async () => {
    const trainer = await createTestUser({
      role: "trainer",
      email: "workout-detail-trainer@example.com",
    });
    const client = await createTestUser({
      email: "workout-detail-client@example.com",
    });
    const plan = await createStoredPlan({
      client: client.user,
      trainer: trainer.user,
    });

    const draftResponse = await withAuth(
      request(app).get(`/api/workout-plans/${plan._id}`),
      client.accessToken,
    );
    await WorkoutPlan.updateOne(
      { _id: plan._id },
      { $set: { status: "published" } },
    );
    const publishedResponse = await withAuth(
      request(app).get(`/api/workout-plans/${plan._id}`),
      client.accessToken,
    );

    expect(draftResponse.status).toBe(403);
    expect(publishedResponse.status).toBe(200);
  });
});
