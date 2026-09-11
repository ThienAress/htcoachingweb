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
afterEach(async () => {
  vi.unstubAllEnvs();
  await clearCollections();
});
afterAll(teardownTestDB);

const createLeadAdmin = async (overrides = {}) => {
  const admin = await createTestUser({ role: "admin", ...overrides });
  vi.stubEnv("DEFAULT_ADMIN_TRAINER_ID", String(admin.user._id));
  return admin;
};

describe("Order explicit conversion origin", () => {
  it("keeps old create behavior and ignores status/session mass assignment", async () => {
    const admin = await createLeadAdmin();

    const response = await withAuth(
      request(app).post("/api/orders"),
      admin.accessToken,
    ).send(orderPayload({ status: "approved", totalSessions: 999 }));

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      status: "pending",
      sessions: 12,
      totalSessions: 12,
      trainerId: String(admin.user._id),
    });
  });

  it("allows the configured admin lead past trainer-plan capacity but rejects another admin", async () => {
    const lead = await createLeadAdmin({ email: "order-lead@example.com" });
    const otherAdmin = await createTestUser({
      role: "admin",
      email: "order-other-admin@example.com",
    });

    const leadResponses = await Promise.all(
      Array.from({ length: 4 }, (_, index) =>
        withAuth(
          request(app).post("/api/orders"),
          lead.accessToken,
        ).send(orderPayload({ email: `order-lead-client-${index}@example.com` })),
      ),
    );
    const otherAdminResponse = await withAuth(
      request(app).post("/api/orders"),
      lead.accessToken,
    ).send(orderPayload({
      email: "order-other-admin-client@example.com",
      trainerId: String(otherAdmin.user._id),
    }));

    expect(leadResponses.every((response) => response.status === 200)).toBe(true);
    expect(otherAdminResponse.status).toBe(409);
  });

  it("captures the coaching entitlement policy when an Order is approved", async () => {
    const admin = await createLeadAdmin();
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

  it("persists the configured lead when either approval endpoint approves a legacy pending order", async () => {
    const lead = await createLeadAdmin({ email: "approval-lead@example.com" });
    const client = await createTestUser({
      email: "approval-legacy-client@example.com",
    });
    const pending = await Order.create({
      ...orderPayload({ email: client.user.email }),
      userId: client.user._id,
      status: "pending",
      trainerId: null,
      totalSessions: 12,
    });

    const approved = await withAuth(
      request(app).put(`/api/orders/${pending._id}/approve`),
      lead.accessToken,
    );
    expect(approved.status).toBe(200);
    expect(String(approved.body.data.trainerId)).toBe(String(lead.user._id));

    const pendingViaUpdate = await Order.create({
      ...orderPayload({ email: "approval-update-client@example.com" }),
      userId: (await createTestUser({
        email: "approval-update-client@example.com",
      })).user._id,
      status: "pending",
      trainerId: null,
      totalSessions: 12,
    });
    const approvedViaUpdate = await withAuth(
      request(app).put(`/api/orders/${pendingViaUpdate._id}`).send({
        status: "approved",
      }),
      lead.accessToken,
    );
    expect(approvedViaUpdate.status).toBe(200);
    expect(String(approvedViaUpdate.body.data.trainerId)).toBe(
      String(lead.user._id),
    );
  });

  it("does not approve a null assignment when no default lead is configured", async () => {
    vi.stubEnv("DEFAULT_ADMIN_TRAINER_ID", "");
    vi.stubEnv("ADMIN_EMAIL", "");
    const admin = await createTestUser({
      role: "admin",
      email: "approval-no-config-admin@example.com",
    });
    const client = await createTestUser({
      email: "approval-no-config-client@example.com",
    });
    const pending = await Order.create({
      ...orderPayload({ email: client.user.email }),
      userId: client.user._id,
      status: "pending",
      trainerId: null,
      totalSessions: 12,
    });

    const response = await withAuth(
      request(app).put(`/api/orders/${pending._id}/approve`),
      admin.accessToken,
    );

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("TRAINER_ASSIGNMENT_REQUIRED");
    expect(await Order.findById(pending._id).lean()).toMatchObject({
      status: "pending",
      trainerId: null,
    });
  });

  it("keeps explicit orders for the lead in personal check-in options only", async () => {
    const lead = await createLeadAdmin({ email: "checkin-lead@example.com" });
    const otherAdmin = await createTestUser({
      role: "admin",
      email: "checkin-other-admin@example.com",
    });
    await Order.create([
      {
        ...orderPayload({ email: "checkin-lead-client@example.com" }),
        trainerId: lead.user._id,
        status: "approved",
        totalSessions: 12,
      },
      {
        ...orderPayload({ email: "checkin-other-client@example.com" }),
        trainerId: otherAdmin.user._id,
        status: "approved",
        totalSessions: 12,
      },
    ]);

    const [leadOptions, otherOptions] = await Promise.all([
      withAuth(
        request(app).get("/api/orders/checkin-options"),
        lead.accessToken,
      ),
      withAuth(
        request(app).get("/api/orders/checkin-options"),
        otherAdmin.accessToken,
      ),
    ]);

    expect(leadOptions.status).toBe(200);
    expect(leadOptions.body.data.map((order) => order.email)).toContain(
      "checkin-lead-client@example.com",
    );
    expect(leadOptions.body.data.map((order) => order.email)).not.toContain(
      "checkin-other-client@example.com",
    );
    expect(otherOptions.status).toBe(200);
    expect(otherOptions.body.data.map((order) => order.email)).toEqual([
      "checkin-other-client@example.com",
    ]);
  });

  it("persists a validated Booking origin for an admin-created Order", async () => {
    const admin = await createLeadAdmin();
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

  it("keeps lead check-in search within effective assignment", async () => {
    const admin = await createLeadAdmin();
    const other = await createTestUser({role: "trainer", email: "search-other-coach@example.com"});
    const own = await Order.create({ ...orderPayload(), name: "SharedSearch Lead", trainerId: admin.user._id, status: "approved", totalSessions: 12 });
    await Order.create({ ...orderPayload(), name: "SharedSearch Other", trainerId: other.user._id, status: "approved", totalSessions: 12 });
    const response = await withAuth(request(app).get("/api/orders/checkin-options?search=SharedSearch"), admin.accessToken);
    expect(response.status).toBe(200);
    expect(response.body.data.map(item => item._id)).toEqual([String(own._id)]);
  });

  it("rejects a missing Contact origin before creating an Order", async () => {
    const admin = await createLeadAdmin();

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
    const admin = await createLeadAdmin();
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
    const admin = await createLeadAdmin();
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
    const admin = await createLeadAdmin();
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
