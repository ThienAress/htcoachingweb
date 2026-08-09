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
import f1CustomerRoutes from "../../routes/f1Customer.routes.js";
import { errorHandler } from "../../middlewares/errorHandler.js";
import Booking from "../../models/Booking.js";
import ContactMessage from "../../models/ContactMessage.js";
import F1Customer from "../../models/F1Customer.js";
import TrainerSubscription from "../../models/TrainerSubscription.js";

let app;

const createTrainer = async (email) => {
  const actor = await createTestUser({ email, role: "trainer" });
  await TrainerSubscription.create({
    userId: actor.user._id,
    planTitle: "Chuyên nghiệp",
    planCode: "professional",
    billingCycle: "month",
    source: "admin_grant",
    amount: 0,
    startDate: new Date(Date.now() - 60_000),
    endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    status: "active",
    isActive: true,
  });
  return actor;
};

const customerPayload = (assignedTrainerId) => ({
  fullName: "Khach Hang F1",
  age: 30,
  gender: "female",
  occupation: "Van phong",
  phone: "0912345678",
  email: "f1authorization@gmail.com",
  assignedTrainerId,
});

const createContact = () =>
  ContactMessage.create({
    name: "Contact Origin",
    email: "contact-origin@example.com",
    phone: "0912345678",
    social: "facebook",
    package: "ONLINE",
  });

const createBooking = () =>
  Booking.create({
    name: "Booking Origin",
    email: "booking-origin@example.com",
    phone: "0912345678",
    gym: "Home gym",
    schedule: "Thu 2",
    package: "ONLINE",
    sessions: 12,
    clientRequestId: "f1-origin-booking-request",
    requestFingerprint: "a".repeat(64),
  });

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/f1-customers", f1CustomerRoutes);
  app.use(errorHandler);
});
afterEach(clearCollections);
afterAll(teardownTestDB);

describe("F1 customer assignment authorization", () => {
  it("self-assigns trainer-created customers", async () => {
    const owner = await createTrainer("f1-owner-create@example.com");
    const target = await createTrainer("f1-target-create@example.com");
    const response = await withAuth(
      request(app).post("/api/f1-customers"),
      owner.accessToken,
    ).send(customerPayload(String(target.user._id)));

    const created = await F1Customer.findById(response.body.data?._id).lean();
    expect(String(created?.assignedTrainerId)).toBe(String(owner.user._id));
  });

  it("rejects trainer attempts to transfer an owned customer", async () => {
    const owner = await createTrainer("f1-owner-update@example.com");
    const target = await createTrainer("f1-target-update@example.com");
    const customer = await F1Customer.create({
      code: "F1-AUTH-1",
      ...customerPayload(String(owner.user._id)),
      createdBy: owner.user._id,
    });
    const response = await withAuth(
      request(app).patch(`/api/f1-customers/${customer._id}`),
      owner.accessToken,
    ).send({ assignedTrainerId: String(target.user._id) });

    expect(response.status).toBe(403);
  });

  it("keeps admin reassignment available", async () => {
    const owner = await createTrainer("f1-owner-admin@example.com");
    const target = await createTrainer("f1-target-admin@example.com");
    const admin = await createTestUser({
      email: "f1-admin@example.com",
      role: "admin",
    });
    const customer = await F1Customer.create({
      code: "F1-AUTH-2",
      ...customerPayload(String(owner.user._id)),
      createdBy: owner.user._id,
    });
    const response = await withAuth(
      request(app).patch(`/api/f1-customers/${customer._id}`),
      admin.accessToken,
    ).send({ assignedTrainerId: String(target.user._id) });

    expect(response.status).toBe(200);
    expect(String(response.body.data.assignedTrainerId)).toBe(
      String(target.user._id),
    );
  });

  it("allows an admin to create F1 from an existing Contact origin", async () => {
    const admin = await createTestUser({
      email: "f1-origin-admin@example.com",
      role: "admin",
    });
    const contact = await createContact();

    const response = await withAuth(
      request(app).post("/api/f1-customers"),
      admin.accessToken,
    ).send({
      ...customerPayload(null),
      originContactMessageId: String(contact._id),
    });
    const created = await F1Customer.findById(response.body.data?._id)
      .select("+originContactMessageId")
      .lean();

    expect(response.status).toBe(201);
    expect(String(created?.originContactMessageId)).toBe(String(contact._id));
  });

  it("allows an admin to create F1 from an existing Booking origin", async () => {
    const admin = await createTestUser({
      email: "f1-booking-admin@example.com",
      role: "admin",
    });
    const booking = await createBooking();

    const response = await withAuth(
      request(app).post("/api/f1-customers"),
      admin.accessToken,
    ).send({
      ...customerPayload(null),
      originBookingId: String(booking._id),
    });

    expect(response.status).toBe(201);
  });

  it("rejects a trainer-supplied origin because leads are admin-only", async () => {
    const trainer = await createTrainer("f1-origin-trainer@example.com");
    const contact = await createContact();

    const response = await withAuth(
      request(app).post("/api/f1-customers"),
      trainer.accessToken,
    ).send({
      ...customerPayload(String(trainer.user._id)),
      originContactMessageId: String(contact._id),
    });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("CONVERSION_ORIGIN_ADMIN_REQUIRED");
  });

  it("rejects a missing origin without creating an F1 customer", async () => {
    const admin = await createTestUser({
      email: "f1-origin-missing@example.com",
      role: "admin",
    });

    const response = await withAuth(
      request(app).post("/api/f1-customers"),
      admin.accessToken,
    ).send({
      ...customerPayload(null),
      originBookingId: String(new F1Customer()._id),
    });

    expect(response.status).toBe(404);
    expect(await F1Customer.countDocuments()).toBe(0);
  });
});
