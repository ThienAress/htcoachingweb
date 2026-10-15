import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import sharp from "sharp";
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
import F1Media from "../../models/F1Media.js";
import F1PhaseReview from "../../models/F1PhaseReview.js";
import F1ResultPrediction from "../../models/F1ResultPrediction.js";
import TrainerSubscription from "../../models/TrainerSubscription.js";
import {
  resetF1MediaStorageAdapterForTests,
  setF1MediaStorageAdapterForTests,
} from "../../services/f1MediaStorage.service.js";

const aiMock = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("../../services/aiImageGenerator.service.js", () => ({
  generateStageImagesWithAI: aiMock.generate,
}));

let app;
let stored;
let dataUrl;

const png = () =>
  sharp({ create: { width: 64, height: 96, channels: 3, background: { r: 200, g: 150, b: 120 } } })
    .png()
    .toBuffer();

const installStorage = () => {
  stored = new Map();
  setF1MediaStorageAdapterForTests({
    async putProcessedImage(buffer, options) {
      const storageKey = `mock/${options.mediaId}.webp`;
      stored.set(storageKey, Buffer.from(buffer));
      return { provider: "mock", storageKey };
    },
    async getSignedReadUrl(media) {
      return `https://private.example.test/${media.storageKey}`;
    },
    async readPrivateObject(media) {
      return stored.get(media.storageKey) || null;
    },
    async deleteObject({ storageKey }) {
      return { deleted: true, notFound: !stored.delete(storageKey) };
    },
    async getMetadata(media) {
      const buffer = stored.get(media.storageKey);
      return buffer ? { bytes: buffer.length } : null;
    },
  });
};

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

const createFixture = async (trainerId, { withReview = true } = {}) => {
  const customer = await F1Customer.create({
    code: `F1-VIS-${Math.random().toString(36).slice(2, 7)}`,
    fullName: "Khach Hang F1",
    age: 30,
    gender: "female",
    phone: "0912345678",
    email: `vis-${Math.random().toString(36).slice(2, 7)}@example.com`,
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
    consent: { allowDataStorage: true, allowMediaStorage: true, allowAiAnalysis: true, version: "2026-07" },
    bodyMetrics: { heightCm: 160, weightKg: 75 },
    trainingProfileGoal: { primaryGoal: "fat_loss" },
  });
  const assessment = await F1Assessment.create({ customerId: customer._id, intakeId: intake._id, createdBy: trainerId });
  const aiReport = await F1AiReport.create({
    customerId: customer._id,
    intakeId: intake._id,
    assessmentId: assessment._id,
    recommendations: { recommendedStartPhase: "phase_2" },
  });
  const prediction = await F1ResultPrediction.create({
    customerId: customer._id,
    intakeId: intake._id,
    assessmentId: assessment._id,
    aiReportId: aiReport._id,
    phaseRoadmap: [{ stageOrder: 1, phaseKey: "phase_2", durationWeeks: 10 }],
  });
  if (withReview) {
    await F1PhaseReview.create({
      customerId: customer._id,
      predictionId: prediction._id,
      stageOrder: 1,
      phaseKey: "phase_2",
      measuredAt: new Date(),
      actual: { weightKg: 71 },
      adherence: { plannedSessions: 30, completedSessions: 28 },
      nextPhasePlan: { stageOrder: 2, phaseKey: "phase_3", phaseTitle: "Hypertrophy", durationWeeks: 10 },
      nextOutcome: { baseline: { weightKg: 71, overallPhysicalLevel: "average" } },
    });
  }
  return { customer, prediction };
};

const upload = async (trainer, customerId, side) =>
  withAuth(
    request(app).post(`/api/f1-customers/${customerId}/phase-reviews/2/photos`),
    trainer.accessToken,
  )
    .field("side", side)
    .attach("file", await png(), { filename: `${side}.png`, contentType: "image/png" });

beforeAll(async () => {
  await setupTestDB();
  installStorage();
  dataUrl = `data:image/png;base64,${(await png()).toString("base64")}`;
  app = createTestApp();
  app.use("/api/f1-customers", f1CustomerRoutes);
  app.use(errorHandler);
  await Promise.all([F1Media.init(), F1PhaseReview.init(), TrainerSubscription.init()]);
});
afterEach(async () => {
  await clearCollections();
  resetF1MediaStorageAdapterForTests();
  installStorage();
  aiMock.generate.mockReset();
});
afterAll(async () => {
  resetF1MediaStorageAdapterForTests();
  await teardownTestDB();
});

describe("F1 follow-up stage photos and generated images", () => {
  it("uploads current photos and generates the predicted images for stage 2", async () => {
    const trainer = await createTrainer("f1-vis-ok@example.com");
    const { customer } = await createFixture(trainer.user._id);
    aiMock.generate.mockResolvedValue({ frontUrl: dataUrl, sideUrl: dataUrl, provider: "mock", model: "mock" });

    const front = await upload(trainer, customer._id, "front");
    const side = await upload(trainer, customer._id, "side");
    expect(front.status).toBe(200);
    expect(side.body.data.beforeSideUrl).toContain("/content");

    const generated = await withAuth(
      request(app).post(`/api/f1-customers/${customer._id}/phase-reviews/2/generate-images`),
      trainer.accessToken,
    ).send({ requestId: randomUUID() });

    expect(generated.status).toBe(200);
    expect(generated.body.data).toMatchObject({ imageStatus: "generated", attemptCount: 1 });
    expect(generated.body.data.frontUrl).toContain("/content");
    expect(aiMock.generate).toHaveBeenCalledTimes(1);
    const media = await F1Media.find({ customerId: customer._id });
    expect(media.map((item) => item.type).sort()).toEqual([
      "prediction_front",
      "prediction_side",
      "stage_front",
      "stage_side",
    ]);
    expect(media.every((item) => item.stageOrder === 2)).toBe(true);
  });

  it("requires both photos, a saved previous review and trainer ownership", async () => {
    const trainer = await createTrainer("f1-vis-guard@example.com");
    const other = await createTrainer("f1-vis-other@example.com");
    const { customer } = await createFixture(trainer.user._id);
    const post = (actor, id = customer._id) =>
      withAuth(
        request(app).post(`/api/f1-customers/${id}/phase-reviews/2/generate-images`),
        actor.accessToken,
      ).send({ requestId: randomUUID() });

    expect((await post(trainer)).status).toBe(400);
    expect((await post(other)).status).toBe(403);
    expect((await upload(other, customer._id, "front")).status).toBe(403);

    const noReview = await createFixture(trainer.user._id, { withReview: false });
    expect((await upload(trainer, noReview.customer._id, "front")).status).toBe(409);
    expect(aiMock.generate).not.toHaveBeenCalled();
  });

  it("does not spend an attempt when the image provider fails", async () => {
    const trainer = await createTrainer("f1-vis-fail@example.com");
    const { customer } = await createFixture(trainer.user._id);
    await upload(trainer, customer._id, "front");
    await upload(trainer, customer._id, "side");
    const error = new Error("quota");
    error.code = "AI_IMAGE_PROVIDER_QUOTA";
    error.status = 429;
    error.expose = true;
    aiMock.generate.mockRejectedValue(error);

    const response = await withAuth(
      request(app).post(`/api/f1-customers/${customer._id}/phase-reviews/2/generate-images`),
      trainer.accessToken,
    ).send({ requestId: randomUUID() });

    expect(response.status).toBe(429);
    const review = await F1PhaseReview.findOne({ customerId: customer._id }).lean();
    expect(review.visual.attemptCount).toBe(0);
    expect(review.visual.imageStatus).toBe("failed");
  });
});
