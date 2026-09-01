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
import F1Intake from "../../models/F1Intake.js";
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

describe("F1 intake draft field boundaries", () => {
  const createCustomer = (trainerId, suffix) =>
    F1Customer.create({
      code: `F1-DRAFT-${suffix}`,
      ...customerPayload(String(trainerId)),
      email: `f1-draft-${suffix}@example.com`,
      createdBy: trainerId,
    });

  it("rejects protected and wrong-step roots without mutating the draft", async () => {
    const trainer = await createTrainer("f1-draft-protected@example.com");
    const customer = await createCustomer(trainer.user._id, "PROTECTED");

    const response = await withAuth(
      request(app).post(`/api/f1-customers/${customer._id}/intake/draft`),
      trainer.accessToken,
    ).send({
      step: 1,
      data: {
        customerInfo: { fullName: "Tên hợp lệ" },
        healthScreening: { painLevel: 10 },
        systemFlags: { testPermission: "full_test" },
        version: 999,
        isDraft: false,
      },
    });

    expect(response.status).toBe(400);
    const draft = await F1Intake.findOne({ customerId: customer._id }).lean();
    expect(draft).toBeNull();
  });

  it("rejects protected nested consent and derived biometric fields", async () => {
    const trainer = await createTrainer("f1-draft-nested@example.com");
    const customer = await createCustomer(trainer.user._id, "NESTED");

    const consentResponse = await withAuth(
      request(app).post(`/api/f1-customers/${customer._id}/intake/draft`),
      trainer.accessToken,
    ).send({
      step: 6,
      data: {
        consent: {
          allowDataStorage: true,
          version: "attacker-controlled",
          collectedBy: trainer.user._id,
        },
      },
    });
    const metricsResponse = await withAuth(
      request(app).post(`/api/f1-customers/${customer._id}/intake/draft`),
      trainer.accessToken,
    ).send({
      step: 4,
      data: { bodyMetrics: { heightCm: 180, weightKg: 81, bmi: 1 } },
    });

    expect([consentResponse.status, metricsResponse.status]).toEqual([400, 400]);
  });

  it("runs Mongoose validators for the allowed step root", async () => {
    const trainer = await createTrainer("f1-draft-validator@example.com");
    const customer = await createCustomer(trainer.user._id, "VALIDATOR");

    const response = await withAuth(
      request(app).post(`/api/f1-customers/${customer._id}/intake/draft`),
      trainer.accessToken,
    ).send({
      step: 3,
      data: { lifestyleNutrition: { mealsPerDay: 99 } },
    });

    expect(response.status).toBe(400);
    expect(
      await F1Intake.countDocuments({ customerId: customer._id }),
    ).toBe(0);
  });

  it("persists only the canonical root for a valid draft step", async () => {
    const trainer = await createTrainer("f1-draft-valid@example.com");
    const customer = await createCustomer(trainer.user._id, "VALID");

    const response = await withAuth(
      request(app).post(`/api/f1-customers/${customer._id}/intake/draft`),
      trainer.accessToken,
    ).send({
      step: 4,
      data: { bodyMetrics: { heightCm: 180, weightKg: 81 } },
    });

    expect(response.status).toBe(200);
    expect(response.body.data.bodyMetrics.bmi).toBe(25);
    expect(response.body.data.draftStep).toBe(4);
  });

  it("does not retain a newly-created PII draft when submission consent fails", async () => {
    const trainer = await createTrainer("f1-submit-consent@example.com");
    const customer = await createCustomer(trainer.user._id, "CONSENT");

    const response = await withAuth(
      request(app).post(`/api/f1-customers/${customer._id}/intake/submit`),
      trainer.accessToken,
    ).send({
      customerInfo: {
        fullName: "Khách chưa đồng ý",
        age: 30,
        gender: "female",
      },
      healthScreening: {
        hasPainNow: false,
        painLevel: 0,
      },
      lifestyleNutrition: {
        mealsPerDay: 3,
        usuallyEatOut: false,
        drinkEnoughWater: true,
        sleepHours: 8,
        stressLevel: "low",
        workActivityLevel: "active",
      },
      bodyMetrics: {
        heightCm: 165,
        weightKg: 55,
      },
      trainingProfileGoal: {
        currentlyTraining: false,
        trainingDaysPerWeek: 0,
        sessionDurationMinutes: 0,
        trainingExperience: "none",
        primaryGoal: "maintenance",
      },
      consent: {
        allowDataStorage: false,
        allowMediaStorage: false,
        allowAiAnalysis: false,
      },
    });

    expect(response.status).toBe(400);
    expect(
      await F1Intake.countDocuments({ customerId: customer._id }),
    ).toBe(0);
  });
});
