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
    code: `F1-SD-${suffix}`,
    fullName: "Khach Hang F1",
    age: 30,
    gender: "female",
    phone: "0912345678",
    email: `f1-sd-${suffix}@example.com`,
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
  objective: "Tăng sức mạnh bền, giữ form",
  entryReason: "Khách thích nghi nhanh",
  keyFocus: ["Tăng sức mạnh thân dưới"],
  expectedChanges: ["Vòng eo gọn hơn"],
  exitCriteria: ["Giữ form khi tập tạ vừa"],
  weeklySchedule: {
    sessionMinutes: 60,
    split: "upper_lower",
    days: [true, false, true, false, true, true, false],
    note: "",
  },
  overrides: { weightKg: 66 },
  ...overrides,
});

const post = (actor, path, body) =>
  withAuth(request(app).post(path), actor.accessToken).send(body);

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/f1-customers", f1CustomerRoutes);
  app.use(errorHandler);
  await Promise.all([F1ResultPrediction.init(), F1PhaseReview.init()]);
});
afterEach(clearCollections);
afterAll(teardownTestDB);

describe("trainer-designed stage 1", () => {
  it("saves the trainer design with the weekly schedule and overridden projection", async () => {
    const trainer = await createTrainer("f1-sd-save@example.com");
    const customer = await createCustomer(trainer.user._id, "SAVE");

    const response = await post(trainer, `/api/f1-customers/${customer._id}/result-predictions/generate`, {
      requestId: randomUUID(),
      customStage: design(),
    });

    expect(response.status).toBe(201);
    const data = response.body.data;
    expect(data.planSource).toBe("trainer");
    expect(data.phaseRoadmap).toHaveLength(1);
    expect(data.phaseRoadmap[0]).toMatchObject({
      phaseKey: "phase_2",
      durationWeeks: 10,
      objective: "Tăng sức mạnh bền, giữ form",
      keyFocus: ["Tăng sức mạnh thân dưới"],
      weeklySchedule: { sessionsPerWeek: 4, split: "upper_lower" },
    });
    const [checkpoint] = data.outcomeTable.phaseCheckpoints;
    expect(checkpoint.projected.weightKg).toBe(66);
    expect(checkpoint.systemProjected.weightKg).not.toBe(66);
    expect(checkpoint.deltaFromBaseline.weightKg).toBe(-4);
    expect(checkpoint.overrides).toEqual({ weightKg: 66 });

    // Đánh giá cuối giai đoạn 1 dùng đúng lịch tập và số dự kiến của HLV.
    const reviews = await withAuth(
      request(app).get(`/api/f1-customers/${customer._id}/phase-reviews`),
      trainer.accessToken,
    );
    expect(reviews.body.data.contexts["1"]).toMatchObject({
      phaseKey: "phase_2",
      plannedSessions: 40,
      projected: expect.objectContaining({ weightKg: 66 }),
    });
  });

  it("previews suggestions without saving and rejects invalid designs", async () => {
    const trainer = await createTrainer("f1-sd-preview@example.com");
    const customer = await createCustomer(trainer.user._id, "PREVIEW");

    const preview = await post(trainer, `/api/f1-customers/${customer._id}/result-predictions/preview`, {
      customStage: design({ overrides: {} }),
    });
    expect(preview.status).toBe(200);
    expect(preview.body.data.suggestion.objective).toBeTruthy();
    expect(preview.body.data.systemProjected.weightKg).toBeLessThan(70);
    expect(await F1ResultPrediction.countDocuments()).toBe(0);

    const badPhase = await post(trainer, `/api/f1-customers/${customer._id}/result-predictions/generate`, {
      requestId: randomUUID(),
      customStage: design({ phaseKey: "phase_9" }),
    });
    const noDays = await post(trainer, `/api/f1-customers/${customer._id}/result-predictions/preview`, {
      customStage: design({ weeklySchedule: { sessionMinutes: 60, split: "full_body", days: Array(7).fill(false) } }),
    });
    expect(badPhase.status).toBe(400);
    expect(noDays.status).toBe(400);
  });

  it("accepts up to 24 weeks and the new training methods, and requires a name for a custom one", async () => {
    const trainer = await createTrainer("f1-sd-method@example.com");
    const customer = await createCustomer(trainer.user._id, "METHOD");
    const url = `/api/f1-customers/${customer._id}/result-predictions/preview`;
    const schedule = (extra) => ({
      sessionMinutes: 60,
      days: [true, false, true, false, true, false, false],
      ...extra,
    });

    const longStage = await post(trainer, url, { customStage: design({ durationWeeks: 24 }) });
    const tooLong = await post(trainer, url, { customStage: design({ durationWeeks: 25 }) });
    const pushPull = await post(trainer, url, {
      customStage: design({ weeklySchedule: schedule({ split: "push_pull" }) }),
    });
    const noName = await post(trainer, url, {
      customStage: design({ weeklySchedule: schedule({ split: "custom" }) }),
    });
    const longName = await post(trainer, url, {
      customStage: design({ weeklySchedule: schedule({ split: "custom", customSplitName: "x".repeat(61) }) }),
    });
    const named = await post(trainer, url, {
      customStage: design({ weeklySchedule: schedule({ split: "custom", customSplitName: "Upper / Lower / Cardio" }) }),
    });

    expect(longStage.status).toBe(200);
    expect(tooLong.status).toBe(400);
    expect(pushPull.status).toBe(200);
    expect(noName.status).toBe(400);
    expect(longName.status).toBe(400);
    expect(named.status).toBe(200);
  });

  it("keeps the custom method name when the design is saved", async () => {
    const trainer = await createTrainer("f1-sd-savename@example.com");
    const customer = await createCustomer(trainer.user._id, "SAVENAME");
    const response = await post(trainer, `/api/f1-customers/${customer._id}/result-predictions/generate`, {
      requestId: randomUUID(),
      customStage: design({
        weeklySchedule: {
          sessionMinutes: 45,
          split: "custom",
          customSplitName: "  Cardio + Core  ",
          days: [true, false, true, false, true, false, false],
        },
      }),
    });

    expect(response.status).toBe(201);
    expect(response.body.data.phaseRoadmap[0].weeklySchedule).toMatchObject({
      split: "custom",
      customSplitName: "Cardio + Core",
    });
  });

  it("blocks another trainer", async () => {
    const owner = await createTrainer("f1-sd-owner@example.com");
    const other = await createTrainer("f1-sd-other@example.com");
    const customer = await createCustomer(owner.user._id, "IDOR");

    const response = await post(other, `/api/f1-customers/${customer._id}/result-predictions/preview`, {
      customStage: design(),
    });
    expect(response.status).toBe(403);
  });
});

describe("trainer-designed next stage and deleting the latest stage", () => {
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

  it("designs stage 2 from the trainer choice and deletes only the latest stage", async () => {
    const trainer = await createTrainer("f1-sd-next@example.com");
    const customer = await createCustomer(trainer.user._id, "NEXT");
    const base = `/api/f1-customers/${customer._id}`;
    await post(trainer, `${base}/result-predictions/generate`, { requestId: randomUUID(), customStage: design() });
    await withAuth(request(app).put(`${base}/phase-reviews/1`), trainer.accessToken).send(reviewBody);
    await withAuth(request(app).put(`${base}/phase-reviews/1/profile`), trainer.accessToken).send(profileBody);

    const saved = await withAuth(request(app).put(`${base}/phase-reviews/1/design`), trainer.accessToken).send({
      customStage: design({ phaseKey: "phase_3", durationWeeks: 8, overrides: { waistCm: 82 } }),
    });
    expect(saved.status).toBe(200);
    const [review] = saved.body.data.reviews;
    expect(review.nextPlanSource).toBe("trainer");
    expect(review.nextPhasePlan).toMatchObject({ phaseKey: "phase_3", durationWeeks: 8, weeklySchedule: { sessionsPerWeek: 4 } });
    expect(review.nextOutcome.baseline.weightKg).toBe(67);
    expect(review.nextOutcome.checkpoint.projected.waistCm).toBe(82);

    const removed = await withAuth(request(app).delete(`${base}/phase-reviews/1`), trainer.accessToken);
    expect(removed.status).toBe(200);
    expect(removed.body.data.reviews).toEqual([]);
    expect(await F1PhaseReview.countDocuments()).toBe(0);

    const missing = await withAuth(request(app).delete(`${base}/phase-reviews/1`), trainer.accessToken);
    expect(missing.status).toBe(409);
  });
});
