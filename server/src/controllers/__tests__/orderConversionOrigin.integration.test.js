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
  sendMail: vi.fn(),
}));

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import Booking from "../../models/Booking.js";
import ContactMessage from "../../models/ContactMessage.js";
import Order from "../../models/Order.js";
import User from "../../models/User.js";
import orderRoutes from "../../routes/order.routes.js";

let app;

const orderPayload = (overrides = {}) => ({
  name: "Order Origin Customer",
  email: `order-${new mongoose.Types.ObjectId()}@example.com`,
  phone: "0912345678",
  package: "Online",
  sessions: 12,
  gym: "Home gym",
  schedule: "Thu 2",
  note: "",
  trainerId: null,
  ...overrides,
});

const createBooking = () =>
  Booking.create({
    name: "Booking Origin",
    email: "booking-order-origin@example.com",
    phone: "0912345678",
    gym: "Home gym",
    schedule: "Thu 2",
    package: "ONLINE",
    sessions: 12,
    clientRequestId: `order-origin-${new mongoose.Types.ObjectId()}`,
    requestFingerprint: "b".repeat(64),
  });

beforeAll(async () => {
  await setupTestDB();
  await Order.init();
  app = createTestApp();
  app.use("/api/orders", orderRoutes);
});
afterEach(clearCollections);
afterAll(teardownTestDB);

describe("Order explicit conversion origin", () => {
  it("keeps old create behavior and ignores status/session mass assignment", async () => {
    const admin = await createTestUser({ role: "admin" });

    const response = await withAuth(
      request(app).post("/api/orders"),
      admin.accessToken,
    ).send(orderPayload({ status: "approved", totalSessions: 999 }));

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      status: "pending",
      sessions: 12,
      totalSessions: 12,
    });
  });

  it("captures the coaching entitlement policy when an Order is approved", async () => {
    const admin = await createTestUser({ role: "admin" });
    const created = await withAuth(
      request(app).post("/api/orders"),
      admin.accessToken,
    ).send(orderPayload());

    const approved = await withAuth(
      request(app).put(`/api/orders/${created.body.data._id}/approve`),
      admin.accessToken,
    );
    const stored = await Order.findById(created.body.data._id)
      .select("+entitlementPolicyVersion +entitlementPolicySnapshot")
      .lean();

    expect(approved.status).toBe(200);
    expect(approved.body.data).not.toHaveProperty("entitlementPolicySnapshot");
    expect(stored).toMatchObject({
      status: "approved",
      entitlementPolicyVersion: "2026-08-28.1",
      entitlementPolicySnapshot: {
        meal_scan: expect.objectContaining({
          windows: [
            expect.objectContaining({ key: "daily", limit: 10 }),
            expect.objectContaining({ key: "monthly", limit: 300 }),
          ],
        }),
      },
    });
  });

  it("persists a validated Booking origin for an admin-created Order", async () => {
    const admin = await createTestUser({ role: "admin" });
    const booking = await createBooking();

    const response = await withAuth(
      request(app).post("/api/orders"),
      admin.accessToken,
    ).send(orderPayload({ originBookingId: String(booking._id) }));
    const created = await Order.findById(response.body.data?._id)
      .select("+originBookingId")
      .lean();

    expect(response.status).toBe(200);
    expect(String(created?.originBookingId)).toBe(String(booking._id));
  });

  it("rejects a missing Contact origin before creating an Order", async () => {
    const admin = await createTestUser({ role: "admin" });

    const response = await withAuth(
      request(app).post("/api/orders"),
      admin.accessToken,
    ).send(
      orderPayload({
        originContactMessageId: String(new mongoose.Types.ObjectId()),
      }),
    );

    expect(response.status).toBe(404);
    expect(await Order.countDocuments()).toBe(0);
  });

  it("rejects mutually exclusive origins", async () => {
    const admin = await createTestUser({ role: "admin" });
    const booking = await createBooking();
    const contact = await ContactMessage.create({
      name: "Contact Origin",
      email: "contact-order-origin@example.com",
      phone: "0912345678",
      social: "facebook",
      package: "ONLINE",
    });

    const response = await withAuth(
      request(app).post("/api/orders"),
      admin.accessToken,
    ).send(
      orderPayload({
        originBookingId: String(booking._id),
        originContactMessageId: String(contact._id),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("returns conflict when the same lead is linked to two Orders", async () => {
    const admin = await createTestUser({ role: "admin" });
    const booking = await createBooking();
    const origin = { originBookingId: String(booking._id) };
    await withAuth(
      request(app).post("/api/orders"),
      admin.accessToken,
    ).send(orderPayload(origin));

    const response = await withAuth(
      request(app).post("/api/orders"),
      admin.accessToken,
    ).send(orderPayload(origin));

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("CONVERSION_ORIGIN_ALREADY_LINKED");
  });

  it("does not create an orphan User when an origin is already linked", async () => {
    const admin = await createTestUser({ role: "admin" });
    const booking = await createBooking();
    await Order.create({
      ...orderPayload(),
      totalSessions: 12,
      originBookingId: booking._id,
    });
    const rejectedPayload = orderPayload({
      originBookingId: String(booking._id),
    });

    await withAuth(
      request(app).post("/api/orders"),
      admin.accessToken,
    ).send(rejectedPayload);

    expect(await User.exists({ email: rejectedPayload.email })).toBeNull();
  });
});
