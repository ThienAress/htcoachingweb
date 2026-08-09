import mongoose from "mongoose";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import request from "supertest";

vi.mock("../../utils/sendMail.js", () => ({
  sendMail: vi.fn().mockResolvedValue(undefined),
  sendContractMail: vi.fn().mockResolvedValue(undefined),
}));

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import Contract from "../../models/Contract.js";
import Checkin from "../../models/Checkin.js";
import Order from "../../models/Order.js";
import TrainerSubscription from "../../models/TrainerSubscription.js";
import checkinRoutes from "../../routes/checkin.routes.js";
import contractRoutes from "../../routes/contract.routes.js";
import orderRoutes from "../../routes/order.routes.js";

let app;

const orderPayload = (suffix, overrides = {}) => ({
  name: `Khách ${suffix}`,
  email: `trainer-admin-${suffix}@example.com`,
  phone: "0912345678",
  package: "PT 12",
  sessions: 12,
  gym: "HT Gym",
  schedule: "Thứ 2 - 18:00",
  note: "",
  ...overrides,
});

const createSubscription = (userId) =>
  TrainerSubscription.create({
    userId,
    planTitle: "Tiêu chuẩn",
    planCode: "standard",
    billingCycle: "month",
    amount: 200000,
    startDate: new Date(Date.now() - 60_000),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: "active",
  });

const createAssignedOrder = async (trainerId, suffix, overrides = {}) => {
  const client = await createTestUser({
    email: `assigned-client-${suffix}@example.com`,
  });
  return Order.create({
    userId: client.user._id,
    trainerId,
    ...orderPayload(`assigned-${suffix}`, overrides),
    totalSessions: overrides.totalSessions ?? overrides.sessions ?? 12,
  });
};

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/orders", orderRoutes);
  app.use("/api/contracts", contractRoutes);
  app.use("/api/checkins", checkinRoutes);
  await Promise.all([
    Order.init(),
    Contract.init(),
    Checkin.init(),
    TrainerSubscription.init(),
  ]);
});

afterEach(async () => {
  vi.clearAllMocks();
  await clearCollections();
});

afterAll(teardownTestDB);

describe("trainer-scoped administration", () => {
  it("lets a subscribed user create an order assigned by the server to themselves", async () => {
    const trainer = await createTestUser({
      email: "subscribed-trainer@example.com",
      role: "user",
    });
    await createSubscription(trainer.user._id);

    const response = await withAuth(
      request(app).post("/api/orders"),
      trainer.accessToken,
    ).send(
      orderPayload("self-create", {
        trainerId: String(new mongoose.Types.ObjectId()),
      }),
    );

    expect(response.status).toBe(200);
    expect(String(response.body.data.trainerId)).toBe(String(trainer.user._id));
  });

  it("lists and updates only orders assigned to the current trainer", async () => {
    const trainerA = await createTestUser({
      email: "trainer-a@example.com",
      role: "trainer",
    });
    const trainerB = await createTestUser({
      email: "trainer-b@example.com",
      role: "trainer",
    });
    const ownOrder = await createAssignedOrder(trainerA.user._id, "own");
    const otherOrder = await createAssignedOrder(trainerB.user._id, "other");

    const listed = await withAuth(
      request(app).get("/api/orders"),
      trainerA.accessToken,
    );
    const updatedOwn = await withAuth(
      request(app)
        .put(`/api/orders/${ownOrder._id}`)
        .send({ note: "Đã cập nhật" }),
      trainerA.accessToken,
    );
    const updatedOther = await withAuth(
      request(app)
        .put(`/api/orders/${otherOrder._id}`)
        .send({ note: "Không được phép" }),
      trainerA.accessToken,
    );

    expect(listed.body.data.orders.map((order) => String(order._id))).toEqual([
      String(ownOrder._id),
    ]);
    expect(updatedOwn.status).toBe(200);
    expect(updatedOther.status).toBe(404);
  });

  it("keeps order deletion admin-only for direct API calls", async () => {
    const trainer = await createTestUser({
      email: "no-delete-trainer@example.com",
      role: "trainer",
    });
    const order = await createAssignedOrder(trainer.user._id, "no-delete");

    const response = await withAuth(
      request(app).delete(`/api/orders/${order._id}`),
      trainer.accessToken,
    );

    expect(response.status).toBe(403);
    expect(await Order.findById(order._id)).not.toBeNull();
  });

  it("keeps approved order identity and session balance admin-controlled", async () => {
    const trainer = await createTestUser({
      email: "approved-order-trainer@example.com",
      role: "trainer",
    });
    const order = await createAssignedOrder(trainer.user._id, "approved-safe", {
      status: "approved",
      sessions: 5,
      totalSessions: 12,
    });

    const response = await withAuth(
      request(app)
        .put(`/api/orders/${order._id}`)
        .send({
          email: "other-identity@example.com",
          package: "VIP",
          sessions: 12,
          note: "Thông tin vận hành được cập nhật",
        }),
      trainer.accessToken,
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        email: order.email,
        package: order.package,
        sessions: 5,
        note: "Thông tin vận hành được cập nhật",
      }),
    );
  });

  it("lists check-in history only from the current trainer's orders", async () => {
    const trainerA = await createTestUser({
      email: "checkin-trainer-a@example.com",
      role: "trainer",
    });
    const trainerB = await createTestUser({
      email: "checkin-trainer-b@example.com",
      role: "trainer",
    });
    const ownOrder = await createAssignedOrder(trainerA.user._id, "checkin-own", {
      status: "approved",
    });
    const otherOrder = await createAssignedOrder(trainerB.user._id, "checkin-other", {
      status: "approved",
    });
    const ownCheckin = await Checkin.create({
      orderId: ownOrder._id,
      clientRequestId: "trainer-own-checkin",
      name: ownOrder.name,
      package: ownOrder.package,
      time: new Date(),
      muscle: "Upper body",
      remainingSessions: ownOrder.sessions - 1,
    });
    await Checkin.create({
      orderId: otherOrder._id,
      clientRequestId: "trainer-other-checkin",
      name: otherOrder.name,
      package: otherOrder.package,
      time: new Date(),
      muscle: "Lower body",
      remainingSessions: otherOrder.sessions - 1,
    });

    const response = await withAuth(
      request(app).get("/api/checkins"),
      trainerA.accessToken,
    );

    expect(response.status).toBe(200);
    expect(response.body.data.map((checkin) => String(checkin._id))).toEqual([
      String(ownCheckin._id),
    ]);
  });

  it("lists only contracts owned by the current trainer", async () => {
    const trainerA = await createTestUser({
      email: "contract-trainer-a@example.com",
      role: "trainer",
    });
    const trainerB = await createTestUser({
      email: "contract-trainer-b@example.com",
      role: "trainer",
    });
    const ownOrder = await createAssignedOrder(trainerA.user._id, "contract-own");
    const otherOrder = await createAssignedOrder(trainerB.user._id, "contract-other");
    const ownContract = await Contract.create({
      orderId: ownOrder._id,
      clientId: ownOrder.userId,
      trainerId: trainerA.user._id,
      clientInfo: { name: ownOrder.name },
      status: "draft",
    });
    await Contract.create({
      orderId: otherOrder._id,
      clientId: otherOrder.userId,
      trainerId: trainerB.user._id,
      clientInfo: { name: otherOrder.name },
      status: "draft",
    });

    const response = await withAuth(
      request(app).get("/api/contracts"),
      trainerA.accessToken,
    );

    expect(response.status).toBe(200);
    expect(response.body.data.map((contract) => String(contract._id))).toEqual([
      String(ownContract._id),
    ]);
  });

  it("creates and updates contracts only from the trainer's own orders", async () => {
    const trainerA = await createTestUser({
      email: "contract-write-a@example.com",
      role: "trainer",
    });
    const trainerB = await createTestUser({
      email: "contract-write-b@example.com",
      role: "trainer",
    });
    const ownOrder = await createAssignedOrder(trainerA.user._id, "write-own", {
      status: "approved",
    });
    const otherOrder = await createAssignedOrder(trainerB.user._id, "write-other", {
      status: "approved",
    });

    const created = await withAuth(
      request(app).post("/api/contracts"),
      trainerA.accessToken,
    ).send({ orderId: ownOrder._id });
    const rejectedCreate = await withAuth(
      request(app).post("/api/contracts"),
      trainerA.accessToken,
    ).send({ orderId: otherOrder._id });
    const updated = await withAuth(
      request(app)
        .put(`/api/contracts/${created.body.data?._id}`)
        .send({ trainerInfo: { address: "Quận 1" } }),
      trainerA.accessToken,
    );

    expect(created.status).toBe(201);
    expect(rejectedCreate.status).toBe(404);
    expect(updated.status).toBe(200);
  });
});
