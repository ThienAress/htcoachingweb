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
import F1Assessment from "../../models/F1Assessment.js";
import F1Customer from "../../models/F1Customer.js";
import F1Intake from "../../models/F1Intake.js";
import TrainerSubscription from "../../models/TrainerSubscription.js";
import { buildAssessmentStarterSuggestions } from "../f1Customer/assessmentSuggestions.helpers.js";

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

const createCustomerWithIntake = async (trainerId, suffix) => {
  const customer = await F1Customer.create({
    code: `F1-EX-${suffix}`,
    fullName: "Khach Hang F1",
    age: 30,
    gender: "female",
    phone: "0912345678",
    email: `f1-ex-${suffix}@example.com`,
    assignedTrainerId: trainerId,
    createdBy: trainerId,
  });
  await F1Intake.create({
    customerId: customer._id,
    isDraft: false,
    isLatest: true,
    draftStep: 6,
    createdBy: trainerId,
    updatedBy: trainerId,
    consent: { allowDataStorage: true },
  });
  return customer;
};

const exercise = (overrides = {}) => ({
  name: "Hít đất tường (Wall Push-Up)",
  source: "system",
  tier: "easy",
  inputMode: "reps",
  sets: 3,
  reps: 10,
  score: 7,
  level: "average",
  ...overrides,
});

const assessmentBody = ({ exercises, overheadSquat } = {}) => ({
  movementAssessment: {
    overheadSquat: overheadSquat || { anterior: [], lateral: [], posterior: [] },
  },
  strengthAssessment: {
    upperBodyPush: { score: 7, level: "average", exercises: exercises || [exercise()] },
    upperBodyPull: { score: 6, level: "average" },
    lowerBody: { score: 6, level: "average" },
    coreStrength: { score: 6, level: "average" },
  },
  enduranceAssessment: {
    muscularEndurance: { score: 6, level: "average" },
    coreEndurance: { score: 6, level: "average" },
  },
  cardioAssessment: {
    cardioCapacity: { score: 6, level: "average" },
    recoveryHeartRate: { score: 6, level: "average" },
  },
});

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/f1-customers", f1CustomerRoutes);
  app.use(errorHandler);
  await Promise.all([F1Customer.init(), F1Intake.init(), F1Assessment.init()]);
});
afterEach(clearCollections);
afterAll(teardownTestDB);

describe("F1 assessment multi-exercise metrics", () => {
  it("stores up to three tested exercises including a custom coach exercise", async () => {
    const trainer = await createTrainer("f1-ex-save@example.com");
    const customer = await createCustomerWithIntake(trainer.user._id, "SAVE");

    const response = await withAuth(
      request(app).post(`/api/f1-customers/${customer._id}/assessments`),
      trainer.accessToken,
    ).send(
      assessmentBody({
        exercises: [
          exercise(),
          exercise({ name: "Hít đất chuẩn (Full Push-Up)", tier: "advanced" }),
          exercise({
            name: "Bài test riêng của HLV",
            source: "custom",
            tier: "",
            level: "good",
            score: 9,
          }),
        ],
      }),
    );

    expect(response.status).toBe(201);
    const saved = await F1Assessment.findOne({ customerId: customer._id }).lean();
    const stored = saved.strengthAssessment.upperBodyPush.exercises;
    expect(stored).toHaveLength(3);
    expect(stored[2]).toMatchObject({ source: "custom", level: "good" });
    expect(saved.strengthAssessment.upperBodyPush.level).toBe("average");
  });

  it("rejects more than three exercises and over-long names", async () => {
    const trainer = await createTrainer("f1-ex-limit@example.com");
    const customer = await createCustomerWithIntake(trainer.user._id, "LIMIT");
    const post = (body) =>
      withAuth(
        request(app).post(`/api/f1-customers/${customer._id}/assessments`),
        trainer.accessToken,
      ).send(body);

    const tooMany = await post(
      assessmentBody({ exercises: Array.from({ length: 4 }, () => exercise()) }),
    );
    const tooLong = await post(
      assessmentBody({ exercises: [exercise({ name: "a".repeat(81) })] }),
    );

    expect([tooMany.status, tooLong.status]).toEqual([400, 400]);
    expect(await F1Assessment.countDocuments({ customerId: customer._id })).toBe(0);
  });

  it("keeps old assessments readable and persists the no-compensation flags", async () => {
    const trainer = await createTrainer("f1-ex-ohsa@example.com");
    const customer = await createCustomerWithIntake(trainer.user._id, "OHSA");

    const response = await withAuth(
      request(app).post(`/api/f1-customers/${customer._id}/assessments`),
      trainer.accessToken,
    ).send({
      ...assessmentBody({
        overheadSquat: {
          anterior: [],
          lateral: ["low_back_arch"],
          posterior: [],
          anteriorNormal: true,
          lateralNormal: "yes",
        },
      }),
      strengthAssessment: { upperBodyPush: { score: 5, level: "below_average" } },
    });

    expect(response.status).toBe(201);
    const saved = await F1Assessment.findOne({ customerId: customer._id }).lean();
    expect(saved.movementAssessment.overheadSquat).toMatchObject({
      anteriorNormal: true,
      lateralNormal: false,
      posteriorNormal: false,
    });
    expect(saved.strengthAssessment.upperBodyPush.exercises ?? []).toEqual([]);
  });
});

describe("assessment starter suggestions", () => {
  it("returns keyed three-tier suggestions for every metric card", async () => {
    const { sections } = await buildAssessmentStarterSuggestions({
      intake: { trainingProfileGoal: { currentlyTraining: false } },
      customer: {},
    });

    expect(sections.strength.map((item) => item.key)).toEqual([
      "upperBodyPush",
      "upperBodyPull",
      "lowerBody",
      "coreStrength",
    ]);
    expect(sections.endurance.map((item) => item.key)).toEqual([
      "muscularEndurance",
      "coreEndurance",
    ]);
    expect(sections.cardio.map((item) => item.key)).toEqual([
      "cardioCapacity",
      "recoveryHeartRate",
    ]);
    for (const item of [
      ...sections.strength,
      ...sections.endurance,
      ...sections.cardio,
    ]) {
      expect(item.tiers.easy.length).toBeGreaterThan(0);
      expect(item.tiers.standard.length).toBeGreaterThan(0);
      expect(item.tiers.advanced.length).toBeGreaterThan(0);
      expect(item.target).toMatch(/\(.+\)$/);
    }
  });
});
