import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import request from "supertest";

import {
  clearCollections,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import CoachingDay from "../../models/CoachingDay.js";
import { resetCoachingPrivateMediaAdapterForTests } from "../../services/coachingPrivateMedia.service.js";
import {
  createAssignment,
  createCoachingSecurityTestApp,
  createPlan,
  installPrivateMediaAdapter,
} from "./coachingSecurity.testSupport.js";

let app;
let mediaAdapter;

beforeAll(async () => {
  await setupTestDB();
  app = createCoachingSecurityTestApp();
});
beforeEach(() => {
  mediaAdapter = installPrivateMediaAdapter();
});
afterEach(async () => {
  resetCoachingPrivateMediaAdapterForTests();
  await clearCollections();
});
afterAll(teardownTestDB);

describe("Coaching upload security boundaries", () => {
  it("does not let another assigned trainer delete a CoachingDay they do not own", async () => {
    const clientAccount = await createTestUser({
      email: "coaching-delete-client@example.com",
    });
    const ownerAccount = await createTestUser({
      email: "coaching-delete-owner@example.com",
      role: "trainer",
    });
    const otherTrainerAccount = await createTestUser({
      email: "coaching-delete-other@example.com",
      role: "trainer",
    });
    await createAssignment({ client: clientAccount.user, trainer: ownerAccount.user });
    await createAssignment({
      client: clientAccount.user,
      trainer: otherTrainerAccount.user,
    });
    const plan = await createPlan({
      client: clientAccount.user,
      trainer: ownerAccount.user,
    });

    const response = await withAuth(
      request(app).delete(
        `/api/coaching/trainer/clients/${clientAccount.user._id}/${plan.dateString}`,
      ),
      otherTrainerAccount.accessToken,
    );

    expect(response.status).toBe(404);
    expect(await CoachingDay.exists({ _id: plan._id })).toBeTruthy();
  });

  it("checks feedback ownership before starting multipart ingestion", async () => {
    const clientAccount = await createTestUser({
      email: "coaching-upload-owner@example.com",
    });

    const response = await withAuth(
      request(app)
        .post(
          "/api/coaching/my-plans/2026-08-28/exercises/507f1f77bcf86cd799439011/feedback-video",
        )
        .attach("video", Buffer.from("private-video"), {
          filename: "feedback.mp4",
          contentType: "video/mp4",
        }),
      clientAccount.accessToken,
    );

    expect(response.status).toBe(404);
    expect(mediaAdapter.uploadStreamSpy).not.toHaveBeenCalled();
  });

  it("streams feedback to authenticated storage and persists only stable metadata", async () => {
    const clientAccount = await createTestUser({
      email: "coaching-private-upload@example.com",
    });
    const trainerAccount = await createTestUser({
      email: "coaching-private-trainer@example.com",
      role: "trainer",
    });
    await createAssignment({
      client: clientAccount.user,
      trainer: trainerAccount.user,
    });
    const plan = await createPlan({
      client: clientAccount.user,
      trainer: trainerAccount.user,
    });
    const exerciseId = plan.exercises[0]._id;

    const response = await withAuth(
      request(app)
        .post(
          `/api/coaching/my-plans/${plan.dateString}/exercises/${exerciseId}/feedback-video`,
        )
        .attach("video", Buffer.from("private-video"), {
          filename: "feedback.mp4",
          contentType: "video/mp4",
        }),
      clientAccount.accessToken,
    );

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.body.url).toContain("https://signed.example.test/");
    expect(mediaAdapter.uploadedBytes).toBe(Buffer.byteLength("private-video"));
    expect(mediaAdapter.uploadOptions).toEqual(
      expect.objectContaining({
        resource_type: "video",
        type: "authenticated",
        access_mode: "authenticated",
      }),
    );
    const stored = await CoachingDay.findById(plan._id).lean();
    expect(stored.exercises[0].clientFeedbackVideo).toEqual(
      expect.objectContaining({
        provider: "cloudinary",
        storageKey: "htcoaching/coaching-feedback-private/client-review",
        resourceType: "video",
        deliveryType: "authenticated",
        format: "mp4",
      }),
    );
    expect(JSON.stringify(stored)).not.toContain("signed.example.test");
  });

  it("retires the legacy upload route without parsing its multipart body", async () => {
    const clientAccount = await createTestUser({
      email: "coaching-legacy-route@example.com",
    });
    const response = await withAuth(
      request(app)
        .post("/api/coaching/my-plans/upload-feedback-video")
        .attach("video", Buffer.from("must-not-be-ingested"), {
          filename: "feedback.mp4",
          contentType: "video/mp4",
        }),
      clientAccount.accessToken,
    );

    expect(response.status).toBe(410);
    expect(mediaAdapter.uploadStreamSpy).not.toHaveBeenCalled();
  });
});
