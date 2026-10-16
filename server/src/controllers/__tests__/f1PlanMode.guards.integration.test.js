import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
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
import F1AiReport from "../../models/F1AiReport.js";
import F1Assessment from "../../models/F1Assessment.js";
import F1Customer from "../../models/F1Customer.js";
import F1Intake from "../../models/F1Intake.js";
import F1PhaseReview from "../../models/F1PhaseReview.js";
import F1ResultPrediction from "../../models/F1ResultPrediction.js";
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

const createCustomer = async (trainerId, suffix) => {
  const customer = await F1Customer.create({
    code: `F1-PM-${suffix}`,
    fullName: "Khach Hang F1",
    age: 30,
    gender: "female",
    phone: "0912345678",
    email: `f1-pm-${suffix}@example.com`,
    assignedTrainerId: trainerId,
    createdBy: trainerId,
  });
  const intake = await F1Intake.create({
    customerId: customer._id,
    isDraft: false,
    isLatest: true,
    draftStep: 6,
    createdBy: trainerId,
    updatedBy: trainerId,
    consent: { allowDataStorage: true, allowAiAnalysis: true, version: "2026-07" },
    bodyMetrics: { heightCm: 170, weightKg: 70, waistCm: 90, hipCm: 90, bodyFatPercent: 35, restingHeartRate: 69 },
    trainingProfileGoal: { primaryGoal: "fat_loss", trainingDaysPerWeek: 3, currentlyTraining: true },
  });
  const assessment = await F1Assessment.create({
    customerId: customer._id,
    intakeId: intake._id,
    createdBy: trainerId,
    overallPhysicalLevel: "average",
  });
  await F1AiReport.create({
    customerId: customer._id,
    intakeId: intake._id,
    assessmentId: assessment._id,
    recommendations: { recommendedStartPhase: "phase_1", trainingFocus: ["energy_expenditure"] },
  });
  return customer;
};

const design = (overrides = {}) => ({
  phaseKey: "phase_2",
  durationWeeks: 10,
  objective: "Tăng sức mạnh bền",
  entryReason: "Khách thích nghi nhanh",
  keyFocus: ["Tăng sức mạnh thân dưới"],
  expectedChanges: ["Vòng eo gọn hơn"],
  exitCriteria: ["Giữ form khi tập tạ vừa"],
  weeklySchedule: { sessionMinutes: 60, split: "upper_lower", days: [true, false, true, false, true, true, false], note: "" },
  overrides: {},
  ...overrides,
});

const reviewBody = {
  measuredAt: new Date().toISOString(),
  actual: { weightKg: 67, waistCm: 86 },
  adherence: { plannedSessions: 40, completedSessions: 36, nutrition: "good", sleep: "good" },
  recommendationChecks: [],
  retests: [],
  ohsa: {},
  safety: {},
};
const profileBody = {
  healthScreening: {},
  lifestyleNutrition: {},
  trainingProfileGoal: { currentlyTraining: true, trainingDaysPerWeek: 4, sessionDurationMinutes: 60, primaryGoal: "fat_loss" },
};

const post = (actor, path, body) => withAuth(request(app).post(path), actor.accessToken).send(body);
const put = (actor, path, body) => withAuth(request(app).put(path), actor.accessToken).send(body);

const generate = (actor, base, customStage) =>
  post(actor, `${base}/result-predictions/generate`, { requestId: randomUUID(), ...(customStage ? { customStage } : {}) });
const switchMode = (actor, base, mode) => post(actor, `${base}/result-predictions/switch-mode`, { mode });
const finishStage = async (actor, base, stageOrder) => {
  await put(actor, `${base}/phase-reviews/${stageOrder}`, reviewBody);
  return put(actor, `${base}/phase-reviews/${stageOrder}/profile`, profileBody);
};

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/f1-customers", f1CustomerRoutes);
  app.use(errorHandler);
  await Promise.all([F1ResultPrediction.init(), F1PhaseReview.init()]);
});
afterEach(clearCollections);
afterAll(teardownTestDB);

describe("plan mode guards", () => {
  it("rejects switching to the mode already in use, without a prediction, or with a stage half done", async () => {
    const trainer = await createTrainer("f1-pm-reject@example.com");
    const customer = await createCustomer(trainer.user._id, "PMREJECT");
    const base = `/api/f1-customers/${customer._id}`;

    expect((await switchMode(trainer, base, "trainer")).body.code).toBe("F1_PREDICTION_REQUIRED");
    await generate(trainer, base);
    expect((await switchMode(trainer, base, "system")).body.code).toBe("F1_PLAN_MODE_UNCHANGED");
    expect((await switchMode(trainer, base, "other")).status).toBe(400);

    await put(trainer, `${base}/phase-reviews/1`, reviewBody); // goal step not confirmed yet
    const pending = await switchMode(trainer, base, "trainer");
    expect(pending.status).toBe(409);
    expect(pending.body.code).toBe("F1_PLAN_MODE_STAGE_PENDING");
    expect((await F1Customer.findById(customer._id).lean()).planModeLockedAt).toBeNull();
  });

  it("lets only one of two simultaneous switches through", async () => {
    const trainer = await createTrainer("f1-pm-race@example.com");
    const customer = await createCustomer(trainer.user._id, "PMRACE");
    const base = `/api/f1-customers/${customer._id}`;
    await generate(trainer, base);

    const results = await Promise.all([switchMode(trainer, base, "trainer"), switchMode(trainer, base, "trainer")]);
    expect(results.map((item) => item.status).sort()).toEqual([200, 409]);
  });

  it("blocks regenerating stage 1 with another method or after the switch", async () => {
    const trainer = await createTrainer("f1-pm-regen@example.com");
    const customer = await createCustomer(trainer.user._id, "PMREGEN");
    const base = `/api/f1-customers/${customer._id}`;
    await generate(trainer, base);

    const wrongMethod = await generate(trainer, base, design());
    expect(wrongMethod.status).toBe(409);
    expect(wrongMethod.body.code).toBe("F1_PLAN_MODE_MISMATCH");

    await switchMode(trainer, base, "trainer");
    const afterSwitch = await generate(trainer, base);
    expect(afterSwitch.status).toBe(409);
    expect(afterSwitch.body.code).toBe("F1_PLAN_MODE_LOCKED");
    expect(await F1ResultPrediction.countDocuments()).toBe(1);
  });

  it("does not let another trainer switch the mode", async () => {
    const owner = await createTrainer("f1-pm-owner@example.com");
    const other = await createTrainer("f1-pm-other@example.com");
    const customer = await createCustomer(owner.user._id, "PMIDOR");
    const base = `/api/f1-customers/${customer._id}`;
    await generate(owner, base);

    expect((await switchMode(other, base, "trainer")).status).toBe(403);
    expect((await F1Customer.findById(customer._id).lean()).planModeLockedAt).toBeNull();
  });
});
