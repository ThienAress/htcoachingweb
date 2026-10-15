import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
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

const createCustomerWithPrediction = async (trainerId, suffix) => {
  const customer = await F1Customer.create({
    code: `F1-PR-${suffix}`,
    fullName: "Khach Hang F1",
    age: 30,
    gender: "female",
    phone: "0912345678",
    email: `f1-pr-${suffix}@example.com`,
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
    consent: { allowDataStorage: true },
    bodyMetrics: { heightCm: 160, weightKg: 75, waistCm: 88 },
    trainingProfileGoal: { primaryGoal: "fat_loss", trainingDaysPerWeek: 3 },
  });
  const assessment = await F1Assessment.create({
    customerId: customer._id,
    intakeId: intake._id,
    createdBy: trainerId,
    strengthAssessment: {
      lowerBody: {
        score: 6.5,
        level: "average",
        exercises: [{ name: "Goblet Squat", tier: "standard", inputMode: "reps", level: "average" }],
      },
    },
  });
  const aiReport = await F1AiReport.create({
    customerId: customer._id,
    intakeId: intake._id,
    assessmentId: assessment._id,
    recommendations: {
      correctiveFocus: ["core_control"],
      trainingFocus: ["energy_expenditure"],
      trainingNotes: ["Ngủ đủ 7 giờ mỗi đêm"],
      recommendedStartPhase: "phase_2",
    },
  });
  await F1ResultPrediction.create({
    customerId: customer._id,
    intakeId: intake._id,
    assessmentId: assessment._id,
    aiReportId: aiReport._id,
    phaseRoadmap: [{ stageOrder: 1, phaseKey: "phase_2", durationWeeks: 10 }],
    outcomeTable: {
      baseline: { weightKg: 75, waistCm: 88, overallPhysicalLevel: "average" },
      phaseCheckpoints: [{ phaseKey: "phase_2", projected: { weightKg: 71.5, waistCm: 85 } }],
    },
  });
  return customer;
};

const reviewBody = (overrides = {}) => ({
  measuredAt: new Date().toISOString(),
  actual: { weightKg: 72, waistCm: 85.5 },
  adherence: { plannedSessions: 30, completedSessions: 28, nutrition: "good", sleep: "fair" },
  recommendationChecks: [
    { text: "Tăng kiểm soát cơ lõi", status: "met" },
    { text: "Ngủ đủ 7 giờ mỗi đêm", status: "partial" },
  ],
  retests: [
    { metricKey: "lowerBody", name: "Goblet Squat", sets: 3, reps: 12, level: "good", previousLevel: "low" },
    { metricKey: "lowerBody", name: "Bài không có trong lộ trình", level: "good" },
  ],
  ohsa: { lateralIssue: true },
  safety: {},
  ...overrides,
});

const put = (app, actor, customerId, stageOrder, body) =>
  withAuth(
    request(app).put(`/api/f1-customers/${customerId}/phase-reviews/${stageOrder}`),
    actor.accessToken,
  ).send(body);

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/f1-customers", f1CustomerRoutes);
  app.use(errorHandler);
  await F1PhaseReview.init();
});
afterEach(clearCollections);
afterAll(teardownTestDB);

describe("F1 phase reviews", () => {
  it("returns the stage-1 context from the prediction, report and assessment", async () => {
    const trainer = await createTrainer("f1-pr-get@example.com");
    const customer = await createCustomerWithPrediction(trainer.user._id, "GET");

    const response = await withAuth(
      request(app).get(`/api/f1-customers/${customer._id}/phase-reviews`),
      trainer.accessToken,
    );

    expect(response.status).toBe(200);
    expect(response.body.data.reviews).toEqual([]);
    const context = response.body.data.contexts["1"];
    expect(context).toMatchObject({ phaseKey: "phase_2", durationWeeks: 10, plannedSessions: 30 });
    expect(context.recommendations).toEqual([
      "Tăng kiểm soát cơ lõi",
      "Ngủ đủ 7 giờ mỗi đêm",
      "Tăng tiêu hao năng lượng",
    ]);
    expect(context.retests).toEqual([
      expect.objectContaining({ metricKey: "lowerBody", name: "Goblet Squat", previousLevel: "average" }),
    ]);
  });

  it("scores stage 1, keeps server-side previous levels and opens stage 2", async () => {
    const trainer = await createTrainer("f1-pr-save@example.com");
    const customer = await createCustomerWithPrediction(trainer.user._id, "SAVE");

    const response = await put(app, trainer, customer._id, 1, reviewBody());

    expect(response.status).toBe(200);
    const [review] = response.body.data.reviews;
    expect(review.retests).toHaveLength(1);
    expect(review.retests[0]).toMatchObject({ name: "Goblet Squat", previousLevel: "average", level: "good" });
    expect(review.evaluation.decision).toBe("advance");
    expect(review.nextPhasePlan).toMatchObject({ stageOrder: 2, phaseKey: "phase_3" });
    expect(review.nextOutcome.baseline.weightKg).toBe(72);
    expect(response.body.data.contexts["2"]).toMatchObject({ phaseKey: "phase_3" });

    const edited = await put(app, trainer, customer._id, 1, reviewBody({ actual: { weightKg: 73 } }));
    expect(edited.status).toBe(200);
    expect(await F1PhaseReview.countDocuments({ customerId: customer._id })).toBe(1);
  });

  it("rejects skipping a stage and invalid input", async () => {
    const trainer = await createTrainer("f1-pr-order@example.com");
    const customer = await createCustomerWithPrediction(trainer.user._id, "ORDER");

    const skipped = await put(app, trainer, customer._id, 2, reviewBody());
    const invalid = await put(app, trainer, customer._id, 1, reviewBody({ actual: { weightKg: 5 } }));
    const injected = await put(app, trainer, customer._id, 1, reviewBody({ adherence: { plannedSessions: { $gt: 0 } } }));

    expect(skipped.status).toBe(409);
    expect(skipped.body.message).toContain("giai đoạn 1");
    expect(invalid.status).toBe(400);
    expect(injected.status).toBe(400);
    expect(await F1PhaseReview.countDocuments()).toBe(0);
  });

  it("blocks another trainer's customer", async () => {
    const owner = await createTrainer("f1-pr-owner@example.com");
    const other = await createTrainer("f1-pr-other@example.com");
    const customer = await createCustomerWithPrediction(owner.user._id, "IDOR");

    const read = await withAuth(
      request(app).get(`/api/f1-customers/${customer._id}/phase-reviews`),
      other.accessToken,
    );
    const write = await put(app, other, customer._id, 1, reviewBody());

    expect(read.status).toBe(403);
    expect(write.status).toBe(403);
    expect(await F1PhaseReview.countDocuments()).toBe(0);
  });

  it("requires the CSRF token for saving", async () => {
    const trainer = await createTrainer("f1-pr-csrf@example.com");
    const customer = await createCustomerWithPrediction(trainer.user._id, "CSRF");

    const response = await request(app)
      .put(`/api/f1-customers/${customer._id}/phase-reviews/1`)
      .set("Cookie", [`accessToken=${trainer.accessToken}`])
      .send(reviewBody());

    expect(response.status).toBe(403);
  });
});
