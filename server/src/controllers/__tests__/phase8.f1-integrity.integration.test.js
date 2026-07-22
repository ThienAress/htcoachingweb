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
import sharp from "sharp";
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
import AuditLog from "../../models/AuditLog.js";
import Counter from "../../models/Counter.js";
import F1AiReport from "../../models/F1AiReport.js";
import F1Assessment from "../../models/F1Assessment.js";
import F1Customer from "../../models/F1Customer.js";
import F1DataDeletionJob from "../../models/F1DataDeletionJob.js";
import F1Intake from "../../models/F1Intake.js";
import F1Media from "../../models/F1Media.js";
import F1MediaDeletionJob from "../../models/F1MediaDeletionJob.js";
import {
  createF1MediaFromBuffer,
  processF1MediaDeletionBatch,
  queueF1MediaDeletion,
} from "../../services/f1MediaLifecycle.service.js";
import {
  resetF1MediaStorageAdapterForTests,
  setF1MediaStorageAdapterForTests,
} from "../../services/f1MediaStorage.service.js";
import { createIdempotentF1Artifact } from "../../services/f1ArtifactIntegrity.service.js";
import {
  processF1DataDeletionBatch,
  requestF1CustomerDeletion,
} from "../../services/f1PrivacyLifecycle.service.js";
import { runPhase8Migration } from "../../migrations/20260720-phase8-f1-private-integrity.js";

let app;
let storedObjects;
let deleteFailures;

const installStorageAdapter = () => {
  storedObjects = new Map();
  deleteFailures = 0;
  setF1MediaStorageAdapterForTests({
    async putProcessedImage(buffer, options) {
      const storageKey = `mock/${options.mediaId}.webp`;
      storedObjects.set(storageKey, Buffer.from(buffer));
      return { provider: "mock", storageKey };
    },
    async getSignedReadUrl(media) {
      return `https://private.example.test/${media.storageKey}?expires=300`;
    },
    async readPrivateObject(media) {
      return storedObjects.get(media.storageKey) || null;
    },
    async deleteObject({ storageKey }) {
      if (deleteFailures > 0) {
        deleteFailures -= 1;
        const error = new Error("provider timeout");
        error.code = "PROVIDER_TIMEOUT";
        throw error;
      }
      const existed = storedObjects.delete(storageKey);
      return { deleted: true, notFound: !existed };
    },
    async getMetadata(media) {
      const buffer = storedObjects.get(media.storageKey);
      return buffer ? { bytes: buffer.length } : null;
    },
  });
};

const createCustomerFixture = async (trainerId, suffix = "") => {
  const customer = await F1Customer.create({
    code: `F1-T${suffix || Date.now()}`,
    fullName: "Phase Eight Client",
    age: 30,
    gender: "female",
    occupation: "Coach",
    phone: "0912345678",
    email: `phase8${suffix}@gmail.com`,
    assignedTrainerId: trainerId,
    createdBy: trainerId,
  });
  const intake = await F1Intake.create({
    customerId: customer._id,
    version: 1,
    isLatest: true,
    isDraft: false,
    submittedAt: new Date(),
    consent: {
      allowDataStorage: true,
      allowMediaStorage: true,
      allowAiAnalysis: true,
      version: "2026-07",
      collectedAt: new Date(),
      collectedBy: trainerId,
    },
    createdBy: trainerId,
    updatedBy: trainerId,
  });
  customer.lastIntakeId = intake._id;
  customer.consentVersion = "2026-07";
  await customer.save();
  return { customer, intake };
};

const validJpeg = () =>
  sharp({
    create: {
      width: 64,
      height: 96,
      channels: 3,
      background: { r: 220, g: 160, b: 120 },
    },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();

beforeAll(async () => {
  await setupTestDB();
  installStorageAdapter();
  app = createTestApp();
  app.use("/api/f1-customers", f1CustomerRoutes);
  app.use(errorHandler);
  await Promise.all([
    AuditLog.init(),
    Counter.init(),
    F1Customer.init(),
    F1Intake.init(),
    F1Media.init(),
    F1MediaDeletionJob.init(),
    F1DataDeletionJob.init(),
    F1Assessment.init(),
    F1AiReport.init(),
  ]);
});

afterEach(async () => {
  await clearCollections();
  resetF1MediaStorageAdapterForTests();
  installStorageAdapter();
  vi.restoreAllMocks();
});

afterAll(async () => {
  resetF1MediaStorageAdapterForTests();
  await teardownTestDB();
});

describe("Phase 8 private F1 media", () => {
  it("rejects fake image bytes and stores valid images re-encoded without public fields", async () => {
    const trainer = await createTestUser({
      email: "phase8-media-trainer@example.com",
      role: "trainer",
    });
    const { customer, intake } = await createCustomerFixture(
      trainer.user._id,
      "media",
    );
    const fake = await withAuth(
      request(app).post(`/api/f1-customers/${customer._id}/media`),
      trainer.accessToken,
    )
      .field("type", "posture_front")
      .field("intakeId", String(intake._id))
      .attach("file", Buffer.from("not-an-image"), {
        filename: "fake.jpg",
        contentType: "image/jpeg",
      });
    expect(fake.status).toBe(400);
    expect(await F1Media.countDocuments()).toBe(0);

    const uploaded = await withAuth(
      request(app).post(`/api/f1-customers/${customer._id}/media`),
      trainer.accessToken,
    )
      .field("type", "posture_front")
      .field("intakeId", String(intake._id))
      .attach("file", await validJpeg(), {
        filename: "body.jpg",
        contentType: "image/jpeg",
      });
    expect(uploaded.status).toBe(201);
    expect(uploaded.body.data).not.toHaveProperty("storageKey");
    expect(uploaded.body.data).not.toHaveProperty("checksum");
    expect(uploaded.body.data.contentPath).toContain("/content");
    const media = await F1Media.findById(uploaded.body.data._id);
    const stored = storedObjects.get(media.storageKey);
    const metadata = await sharp(stored).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.orientation).toBeUndefined();
    expect(media.url).toBe("");
    expect(media.publicId).toBe("");
  });

  it("blocks cross-trainer media reads and redirects authorized reads to a short-lived URL", async () => {
    const owner = await createTestUser({
      email: "phase8-owner@example.com",
      role: "trainer",
    });
    const outsider = await createTestUser({
      email: "phase8-outsider@example.com",
      role: "trainer",
    });
    const { customer, intake } = await createCustomerFixture(
      owner.user._id,
      "idor",
    );
    const created = await createF1MediaFromBuffer({
      customerId: customer._id,
      intakeId: intake._id,
      type: "before_front",
      buffer: await validJpeg(),
      actorId: owner.user._id,
      actorRole: "trainer",
    });
    const path = `/api/f1-customers/${customer._id}/media/${created.media._id}/content`;
    const denied = await withAuth(request(app).get(path), outsider.accessToken);
    expect(denied.status).toBe(403);
    const allowed = await withAuth(request(app).get(path), owner.accessToken);
    expect(allowed.status).toBe(302);
    expect(allowed.headers.location).toContain("expires=300");
    expect(allowed.headers["cache-control"]).toContain("no-store");
    expect(
      await AuditLog.countDocuments({
        action: "read_f1_media",
        targetId: created.media._id,
      }),
    ).toBe(1);
  });

  it("creates a cleanup job when the database transition fails after provider upload", async () => {
    const trainer = await createTestUser({
      email: "phase8-compensation@example.com",
      role: "trainer",
    });
    const { customer, intake } = await createCustomerFixture(
      trainer.user._id,
      "compensation",
    );
    vi.spyOn(F1Media, "findOneAndUpdate").mockRejectedValueOnce(
      Object.assign(new Error("db unavailable"), { code: "DB_DOWN" }),
    );
    await expect(
      createF1MediaFromBuffer({
        customerId: customer._id,
        intakeId: intake._id,
        type: "posture_side",
        buffer: await validJpeg(),
        actorId: trainer.user._id,
        actorRole: "trainer",
      }),
    ).rejects.toThrow("db unavailable");
    const media = await F1Media.findOne({ customerId: customer._id });
    expect(media.status).toBe("delete_pending");
    expect(await F1MediaDeletionJob.countDocuments({ mediaId: media._id })).toBe(
      1,
    );
  });

  it("retries provider deletion and treats a missing provider object as success", async () => {
    const trainer = await createTestUser({
      email: "phase8-delete@example.com",
      role: "trainer",
    });
    const { customer, intake } = await createCustomerFixture(
      trainer.user._id,
      "delete",
    );
    const created = await createF1MediaFromBuffer({
      customerId: customer._id,
      intakeId: intake._id,
      type: "posture_back",
      buffer: await validJpeg(),
      actorId: trainer.user._id,
      actorRole: "trainer",
    });
    await queueF1MediaDeletion({
      media: created.media,
      actorId: trainer.user._id,
      actorRole: "trainer",
    });
    deleteFailures = 1;
    const first = await processF1MediaDeletionBatch({ batchSize: 1 });
    const second = await processF1MediaDeletionBatch({
      batchSize: 1,
      now: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    expect(first.failed).toBe(1);
    expect(second.deleted).toBe(1);
    expect((await F1Media.findById(created.media._id)).status).toBe("deleted");
  });
});

describe("Phase 8 F1 integrity and privacy", () => {
  it("allocates unique F1 codes under concurrent customer creation", async () => {
    const trainer = await createTestUser({
      email: "phase8-counter@example.com",
      role: "trainer",
    });
    const responses = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        withAuth(
          request(app)
            .post("/api/f1-customers")
            .send({
              fullName: `Client Number ${String(index).padStart(2, "0")}`,
              age: 30,
              gender: "male",
              occupation: "Engineer",
              phone: `091234${String(index).padStart(4, "0")}`,
              email: `phase8counter${index}@gmail.com`,
            }),
          trainer.accessToken,
        ),
      ),
    );
    expect(responses.every((response) => response.status === 201)).toBe(true);
    const codes = responses.map((response) => response.body.data.code);
    expect(new Set(codes).size).toBe(12);
  });

  it("deduplicates concurrent artifact commands by request and source", async () => {
    const trainer = await createTestUser({
      email: "phase8-artifact@example.com",
      role: "trainer",
    });
    const { customer, intake } = await createCustomerFixture(
      trainer.user._id,
      "artifact",
    );
    const assessment = await F1Assessment.create({
      customerId: customer._id,
      intakeId: intake._id,
      createdBy: trainer.user._id,
      updatedBy: trainer.user._id,
    });
    const command = {
      Model: F1AiReport,
      customerId: customer._id,
      sourceFields: {
        customerId: customer._id,
        intakeId: intake._id,
        assessmentId: assessment._id,
      },
      sourceDocuments: [intake, assessment],
      engineVersion: "phase8-test",
      requestId: "88888888-8888-4888-8888-888888888888",
      payload: {},
      customerUpdate: (artifact) => ({ lastAiReportId: artifact._id }),
      audit: {
        actorId: trainer.user._id,
        actorRole: "trainer",
        action: "generate_f1_ai_report",
        targetType: "f1_ai_report",
      },
    };
    const results = await Promise.all([
      createIdempotentF1Artifact(command),
      createIdempotentF1Artifact(command),
    ]);
    expect(await F1AiReport.countDocuments()).toBe(1);
    expect(String(results[0].artifact._id)).toBe(
      String(results[1].artifact._id),
    );
  });

  it("deletes provider objects before health data and keeps a pseudonymous tombstone", async () => {
    const trainer = await createTestUser({
      email: "phase8-erasure@example.com",
      role: "trainer",
    });
    const { customer, intake } = await createCustomerFixture(
      trainer.user._id,
      "erasure",
    );
    await F1Assessment.create({
      customerId: customer._id,
      intakeId: intake._id,
      createdBy: trainer.user._id,
    });
    await createF1MediaFromBuffer({
      customerId: customer._id,
      intakeId: intake._id,
      type: "before_side",
      buffer: await validJpeg(),
      actorId: trainer.user._id,
      actorRole: "trainer",
    });
    await requestF1CustomerDeletion({
      customer,
      actorId: trainer.user._id,
      actorRole: "trainer",
    });
    const result = await processF1DataDeletionBatch({ batchSize: 1 });
    expect(result.completed).toBe(1);
    expect(await F1Intake.countDocuments({ customerId: customer._id })).toBe(0);
    expect(await F1Media.countDocuments({ customerId: customer._id })).toBe(0);
    const tombstone = await F1Customer.findById(customer._id);
    expect(tombstone.fullName).toBe("Deleted F1 Customer");
    expect(tombstone.email).toBe("");
    expect((await F1DataDeletionJob.findOne()).status).toBe("completed");
    expect(
      await AuditLog.countDocuments({
        action: "complete_f1_data_deletion",
        actorRole: "trainer",
      }),
    ).toBe(1);
  });

  it("seeds the counter idempotently from the maximum valid F1 code", async () => {
    const trainer = await createTestUser({
      email: "phase8-migration@example.com",
      role: "trainer",
    });
    await F1Customer.create({
      code: "F1-0042",
      fullName: "Migration Client",
      age: 30,
      gender: "male",
      createdBy: trainer.user._id,
    });
    const first = await runPhase8Migration({ migrateMedia: false });
    const second = await runPhase8Migration({ migrateMedia: false });
    expect(first.verification.totalIssues).toBe(0);
    expect(second.verification.totalIssues).toBe(0);
    expect((await Counter.findOne({ key: "f1_customer" })).value).toBe(42);
  });
});
