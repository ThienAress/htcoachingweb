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

describe("switching the plan mode once", () => {
  it("starts from the mode chosen at creation and reports it with the prediction", async () => {
    const trainer = await createTrainer("f1-pm-state@example.com");
    const customer = await createCustomer(trainer.user._id, "PMSTATE");
    const base = `/api/f1-customers/${customer._id}`;

    const created = await generate(trainer, base);
    expect(created.body.data.planModeState).toEqual({ initial: "system", current: "system", locked: false, switchedAtStage: null });

    const latest = await withAuth(request(app).get(`${base}/result-predictions/latest`), trainer.accessToken);
    expect(latest.body.data.planModeState.current).toBe("system");
  });

  it("switches system to trainer once, from the next stage, and then locks", async () => {
    const trainer = await createTrainer("f1-pm-switch@example.com");
    const customer = await createCustomer(trainer.user._id, "PMSWITCH");
    const base = `/api/f1-customers/${customer._id}`;
    await generate(trainer, base);
    await finishStage(trainer, base, 1);

    const switched = await switchMode(trainer, base, "trainer");
    expect(switched.status).toBe(200);
    expect(switched.body.data).toEqual({ initial: "system", current: "trainer", locked: true, switchedAtStage: 3 });

    const stored = await F1Customer.findById(customer._id).lean();
    expect(stored).toMatchObject({ planModeSwitchTo: "trainer", planModeSwitchedAtStage: 3 });
    expect(stored.planModeLockedAt).toBeInstanceOf(Date);

    const again = await switchMode(trainer, base, "system");
    expect(again.status).toBe(409);
    expect(again.body.code).toBe("F1_PLAN_MODE_LOCKED");
    expect((await F1Customer.findById(customer._id).lean()).planModeSwitchTo).toBe("trainer");
  });

  it("keeps the earlier system stage and designs only the later stages by the trainer", async () => {
    const trainer = await createTrainer("f1-pm-keep@example.com");
    const customer = await createCustomer(trainer.user._id, "PMKEEP");
    const base = `/api/f1-customers/${customer._id}`;
    await generate(trainer, base);
    await finishStage(trainer, base, 1); // stage 2 built by the system

    const beforeSwitch = await put(trainer, `${base}/phase-reviews/1/design`, { customStage: design() });
    expect(beforeSwitch.status).toBe(409);
    expect(beforeSwitch.body.code).toBe("F1_PLAN_MODE_MISMATCH");

    await switchMode(trainer, base, "trainer");
    await finishStage(trainer, base, 2); // stage 3 starts the trainer mode
    const stage3 = await put(trainer, `${base}/phase-reviews/2/design`, { customStage: design({ phaseKey: "phase_3" }) });
    expect(stage3.status).toBe(200);

    const reviews = stage3.body.data.reviews;
    expect(reviews[0].nextPlanSource).toBe("system");
    expect(reviews[1].nextPlanSource).toBe("trainer");
    // stage 2 stays system-built and cannot be redesigned by the trainer
    const redesign = await put(trainer, `${base}/phase-reviews/1/design`, { customStage: design() });
    expect(redesign.status).toBe(409);
  });

  it("switches trainer to system and then blocks the trainer design", async () => {
    const trainer = await createTrainer("f1-pm-reverse@example.com");
    const customer = await createCustomer(trainer.user._id, "PMREVERSE");
    const base = `/api/f1-customers/${customer._id}`;
    await generate(trainer, base, design());
    await finishStage(trainer, base, 1);
    const ok = await put(trainer, `${base}/phase-reviews/1/design`, { customStage: design({ phaseKey: "phase_3" }) });
    expect(ok.status).toBe(200);

    expect((await switchMode(trainer, base, "system")).status).toBe(200);
    await finishStage(trainer, base, 2);
    const blocked = await put(trainer, `${base}/phase-reviews/2/design`, { customStage: design() });
    expect(blocked.status).toBe(409);
  });
});
