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
import F1Customer from "../../models/F1Customer.js";
import F1Intake from "../../models/F1Intake.js";
import F1Media from "../../models/F1Media.js";
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

const createCustomer = (trainerId, suffix) =>
  F1Customer.create({
    code: `F1-SUBMIT-${suffix}`,
    fullName: "Khach Hang F1",
    age: 30,
    gender: "female",
    phone: "0912345678",
    email: `f1-submit-${suffix}@example.com`,
    assignedTrainerId: trainerId,
    createdBy: trainerId,
  });

// Mirrors what F1IntakeWizard sends for a customer who is not training and
// skipped the optional lifestyle fields (undefined values are dropped by JSON).
const notTrainingPayload = (overrides = {}) => ({
  customerInfo: {
    fullName: "Khach Hang F1",
    age: 30,
    gender: "female",
    occupation: "",
    phone: "0912345678",
    email: "",
  },
  healthScreening: {
    hasPainNow: false,
    painLocation: [],
    painLevel: 0,
    injuries: "Trật vai cũ",
    currentConditions: "",
    surgeries: "",
    medications: "",
    doctorRestrictions: "",
    warningSigns: [],
  },
  lifestyleNutrition: {
    usuallyEatOut: false,
    foodAllergies: "",
    drinkEnoughWater: true,
    stressLevel: "",
    workActivityLevel: "",
  },
  bodyMetrics: { heightCm: 160, weightKg: 55, bmi: 21.5, waistHipRatio: null },
  trainingProfileGoal: {
    currentlyTraining: false,
    sportsHistory: [],
    trainingExperience: "none",
    breakDuration: "",
    primaryGoal: "fat_loss",
    targetTimeframe: "3 tháng",
    ...overrides.trainingProfileGoal,
  },
  postureMediaSummary: {
    frontImageUploaded: false,
    backImageUploaded: false,
    sideImageUploaded: false,
  },
  consent: {
    allowDataStorage: true,
    allowMediaStorage: true,
    allowAiAnalysis: true,
  },
});

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/f1-customers", f1CustomerRoutes);
  app.use(errorHandler);
  // The submit runs in a transaction; build indexes first so MongoDB does not
  // abort it with "catalog changes" on a fresh in-memory database.
  await Promise.all([F1Customer.init(), F1Intake.init(), F1Media.init()]);
});
afterEach(clearCollections);
afterAll(teardownTestDB);

describe("F1 intake submit validation", () => {
  it("submits a customer who is not training with optional lifestyle fields left empty", async () => {
    const trainer = await createTrainer("f1-submit-idle@example.com");
    const customer = await createCustomer(trainer.user._id, "IDLE");

    const response = await withAuth(
      request(app).post(`/api/f1-customers/${customer._id}/intake/submit`),
      trainer.accessToken,
    ).send(notTrainingPayload());

    expect(response.status).toBe(200);
    const intake = await F1Intake.findOne({ customerId: customer._id }).lean();
    expect(intake.isDraft).toBe(false);
    expect(intake.trainingProfileGoal.targetTimeframe).toBe("3 tháng");
    expect(intake.trainingProfileGoal.trainingDaysPerWeek ?? null).toBeNull();
    expect(intake.healthScreening.injuries).toBe("Trật vai cũ");
  });

  it("still requires training days when the customer is currently training", async () => {
    const trainer = await createTrainer("f1-submit-active@example.com");
    const customer = await createCustomer(trainer.user._id, "ACTIVE");

    const response = await withAuth(
      request(app).post(`/api/f1-customers/${customer._id}/intake/submit`),
      trainer.accessToken,
    ).send(
      notTrainingPayload({
        trainingProfileGoal: {
          currentlyTraining: true,
          trainingExperience: "beginner",
          sessionDurationMinutes: 60,
        },
      }),
    );

    expect(response.status).toBe(400);
    expect(response.body.errors[0].path).toBe(
      "trainingProfileGoal.trainingDaysPerWeek",
    );
  });

  it("rejects a target timeframe longer than 60 characters", async () => {
    const trainer = await createTrainer("f1-submit-timeframe@example.com");
    const customer = await createCustomer(trainer.user._id, "TIMEFRAME");

    const response = await withAuth(
      request(app).post(`/api/f1-customers/${customer._id}/intake/submit`),
      trainer.accessToken,
    ).send(
      notTrainingPayload({
        trainingProfileGoal: { targetTimeframe: "a".repeat(61) },
      }),
    );

    expect(response.status).toBe(400);
    expect(
      await F1Intake.countDocuments({ customerId: customer._id, isDraft: false }),
    ).toBe(0);
  });
});
