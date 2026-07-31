import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
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
import WellnessTarget from "../../models/WellnessTarget.js";
import wellnessTargetRoutes from "../../routes/wellnessTarget.routes.js";

import { getVietnamDateKey } from "../../utils/dateKey.js";

let app;
const today = getVietnamDateKey();
const requestId = (suffix) =>
  `30000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
const targets = { sleepHours: 7.5, waterMl: 2500, steps: 8000 };

const createOrder = ({ clientId, trainerId }) =>
  Order.create({
    userId: clientId,
    trainerId,
    name: "Wellness client",
    email: "wellness-client@example.com",
    package: "PT 10",
    sessions: 5,
    totalSessions: 10,
    status: "approved",
  });

const putTarget = (token, clientId, body) =>
  withAuth(
    request(app)
      .put(`/api/wellness-targets/trainer/clients/${clientId}`)
      .send(body),
    token,
  );

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/wellness-targets", wellnessTargetRoutes);

  await Promise.all([Order.init(), WellnessTarget.init()]);
});

beforeEach(() => {
  process.env.TODAY_WELLNESS_TARGET_WRITES_ENABLED = "true";
});

afterEach(async () => {
  delete process.env.TODAY_WELLNESS_TARGET_WRITES_ENABLED;
  delete process.env.TODAY_WELLNESS_TARGET_RETENTION_ENFORCE;
  await clearCollections();
});

afterAll(async () => {
  await teardownTestDB();
});

describe("Wellness target API", () => {
  it("lets an assigned trainer create targets for an active client", async () => {
    const trainer = await createTestUser({ role: "trainer" });
    const client = await createTestUser();
    await createOrder({ clientId: client.user._id, trainerId: trainer.user._id });

    const response = await putTarget(trainer.accessToken, client.user._id, {
      expectedVersion: 0,
      requestId: requestId(1),
      targets,
      note: "Mục tiêu tháng đầu",
    });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      clientId: String(client.user._id),
      version: 1,
      effectiveFromDateKey: today,
      targets,
      updatedByRole: "trainer",
    });
  });

  it("replays an identical request id without creating a new version", async () => {
    const trainer = await createTestUser({ role: "trainer" });
    const client = await createTestUser();
    await createOrder({ clientId: client.user._id, trainerId: trainer.user._id });
    const body = { expectedVersion: 0, requestId: requestId(2), targets };
    const first = await putTarget(trainer.accessToken, client.user._id, body);

    const replay = await putTarget(trainer.accessToken, client.user._id, body);

    expect(replay.status).toBe(200);
    expect(replay.body.data._id).toBe(first.body.data._id);
    expect(await WellnessTarget.countDocuments({ clientId: client.user._id })).toBe(1);
  });

  it("rejects reusing a request id with a different payload", async () => {
    const trainer = await createTestUser({ role: "trainer" });
    const client = await createTestUser();
    await createOrder({ clientId: client.user._id, trainerId: trainer.user._id });
    const sharedRequestId = requestId(15);
    await putTarget(trainer.accessToken, client.user._id, {
      expectedVersion: 0,
      requestId: sharedRequestId,
      targets,
    });

    const reused = await putTarget(trainer.accessToken, client.user._id, {
      expectedVersion: 0,
      requestId: sharedRequestId,
      targets: { ...targets, steps: 9000 },
    });

    expect(reused.status).toBe(409);
    expect(reused.body.code).toBe("REQUEST_ID_REUSED");
    expect(await WellnessTarget.countDocuments({ clientId: client.user._id })).toBe(1);
  });

  it("rejects a stale expected version", async () => {
    const trainer = await createTestUser({ role: "trainer" });
    const client = await createTestUser();
    await createOrder({ clientId: client.user._id, trainerId: trainer.user._id });
    await putTarget(trainer.accessToken, client.user._id, {
      expectedVersion: 0,
      requestId: requestId(3),
      targets,
    });
    await putTarget(trainer.accessToken, client.user._id, {
      expectedVersion: 1,
      requestId: requestId(4),
      targets: { ...targets, waterMl: 3000 },
    });

    const stale = await putTarget(trainer.accessToken, client.user._id, {
      expectedVersion: 1,
      requestId: requestId(5),
      targets: { ...targets, steps: 9000 },
    });

    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe("WELLNESS_TARGET_VERSION_CONFLICT");
  });

  it("denies a trainer who is not assigned to the client", async () => {
    const assigned = await createTestUser({ role: "trainer" });
    const outsider = await createTestUser({ role: "trainer" });
    const client = await createTestUser();
    await createOrder({ clientId: client.user._id, trainerId: assigned.user._id });

    const response = await putTarget(outsider.accessToken, client.user._id, {
      expectedVersion: 0,
      requestId: requestId(6),
      targets,
    });

    expect(response.status).toBe(403);
  });

  it("lets an admin set targets for any active client", async () => {
    const admin = await createTestUser({ role: "admin" });
    const trainer = await createTestUser({ role: "trainer" });
    const client = await createTestUser();
    await createOrder({ clientId: client.user._id, trainerId: trainer.user._id });

    const response = await putTarget(admin.accessToken, client.user._id, {
      expectedVersion: 0,
      requestId: requestId(7),
      targets,
    });

    expect(response.status).toBe(201);
    expect(response.body.data.updatedByRole).toBe("admin");
  });

  it("uses the admin as trainer-at-creation when an active order has no trainer", async () => {
    const admin = await createTestUser({ role: "admin" });
    const client = await createTestUser();
    await createOrder({ clientId: client.user._id });

    const response = await putTarget(admin.accessToken, client.user._id, {
      expectedVersion: 0,
      requestId: requestId(17),
      targets,
    });

    const saved = await WellnessTarget.findOne({ clientId: client.user._id });
    expect(response.status).toBe(201);
    expect(String(saved?.trainerIdAtCreation)).toBe(String(admin.user._id));
  });

  it("lets an assigned trainer read the latest target for a client", async () => {
    const trainer = await createTestUser({ role: "trainer" });
    const client = await createTestUser();
    await createOrder({ clientId: client.user._id, trainerId: trainer.user._id });
    await putTarget(trainer.accessToken, client.user._id, {
      expectedVersion: 0,
      requestId: requestId(16),
      targets,
    });

    const response = await withAuth(
      request(app).get("/api/wellness-targets/trainer/clients/" + client.user._id),
      trainer.accessToken,
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ version: 1, targets });
  });

  it("lets a client read the target effective for a selected date", async () => {
    const trainer = await createTestUser({ role: "trainer" });
    const client = await createTestUser();
    await createOrder({ clientId: client.user._id, trainerId: trainer.user._id });
    await putTarget(trainer.accessToken, client.user._id, {
      expectedVersion: 0,
      requestId: requestId(8),
      targets,
    });

    const response = await withAuth(
      request(app).get(`/api/wellness-targets/me?dateKey=${today}`),
      client.accessToken,
    );

    expect(response.status).toBe(200);
    expect(response.body.data.targets).toEqual(targets);
  });

  it("supports a write-flag rollback without hiding existing reads", async () => {
    const trainer = await createTestUser({ role: "trainer" });
    const client = await createTestUser();
    await createOrder({ clientId: client.user._id, trainerId: trainer.user._id });
    process.env.TODAY_WELLNESS_TARGET_WRITES_ENABLED = "false";

    const response = await putTarget(trainer.accessToken, client.user._id, {
      expectedVersion: 0,
      requestId: requestId(13),
      targets,
    });

    expect(response.status).toBe(503);
    expect(response.body.code).toBe("WELLNESS_TARGET_WRITES_DISABLED");
  });
  it("validates target boundaries before reaching the service", async () => {
    const trainer = await createTestUser({ role: "trainer" });
    const client = await createTestUser();
    await createOrder({ clientId: client.user._id, trainerId: trainer.user._id });

    const response = await putTarget(trainer.accessToken, client.user._id, {
      expectedVersion: 0,
      requestId: requestId(9),
      targets: { ...targets, waterMl: 0 },
    });

    expect(response.status).toBe(400);
  });

});
