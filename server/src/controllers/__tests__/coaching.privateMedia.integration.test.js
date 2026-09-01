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
import AccountDeletionMediaJob from "../../models/AccountDeletionMediaJob.js";
import { processAccountDeletionMediaJobs } from "../../services/accountDeletionMedia.service.js";
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
  process.env.CLOUDINARY_CLOUD_NAME = "demo";
  mediaAdapter = installPrivateMediaAdapter();
});
afterEach(async () => {
  resetCoachingPrivateMediaAdapterForTests();
  await clearCollections();
});
afterAll(teardownTestDB);

describe("Coaching private media lifecycle", () => {
  it("keeps legacy public feedback readable", async () => {
    const clientAccount = await createTestUser({
      email: "coaching-legacy-video@example.com",
    });
    const trainerAccount = await createTestUser({
      email: "coaching-legacy-video-trainer@example.com",
      role: "trainer",
    });
    const plan = await createPlan({
      client: clientAccount.user,
      trainer: trainerAccount.user,
    });
    const legacyUrl =
      "https://res.cloudinary.com/demo/video/upload/v1/htcoaching/coaching-videos/legacy.mp4";
    plan.exercises[0].clientFeedbackVideo = legacyUrl;
    await plan.save();

    const response = await withAuth(
      request(app).get(`/api/coaching/my-plans/${plan.dateString}`),
      clientAccount.accessToken,
    );

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.body.data.exercises[0].clientFeedbackVideo).toBe(legacyUrl);
  });

  it("only signs private video for the trainer assigned to that plan", async () => {
    const clientAccount = await createTestUser({
      email: "coaching-private-timeline-client@example.com",
    });
    const ownerAccount = await createTestUser({
      email: "coaching-private-timeline-owner@example.com",
      role: "trainer",
    });
    const otherTrainerAccount = await createTestUser({
      email: "coaching-private-timeline-other@example.com",
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
    plan.exercises[0].clientFeedbackVideo = {
      provider: "cloudinary",
      storageKey: "htcoaching/coaching-feedback-private/timeline-review",
      resourceType: "video",
      deliveryType: "authenticated",
      format: "mp4",
    };
    await plan.save();

    const ownerResponse = await withAuth(
      request(app).get(`/api/coaching/trainer/clients/${clientAccount.user._id}`),
      ownerAccount.accessToken,
    );
    const otherResponse = await withAuth(
      request(app).get(`/api/coaching/trainer/clients/${clientAccount.user._id}`),
      otherTrainerAccount.accessToken,
    );

    expect(ownerResponse.status).toBe(200);
    expect(ownerResponse.body.data[0].exercises[0].clientFeedbackVideo).toContain(
      "https://signed.example.test/",
    );
    expect(otherResponse.status).toBe(200);
    expect(otherResponse.body.data).toHaveLength(0);
  });

  it("does not persist an expiring signed URL sent back by autosave", async () => {
    const clientAccount = await createTestUser({
      email: "coaching-signed-url-client@example.com",
    });
    const trainerAccount = await createTestUser({
      email: "coaching-signed-url-trainer@example.com",
      role: "trainer",
    });
    const plan = await createPlan({
      client: clientAccount.user,
      trainer: trainerAccount.user,
    });
    const privateMedia = {
      provider: "cloudinary",
      storageKey: "htcoaching/coaching-feedback-private/persisted-review",
      resourceType: "video",
      deliveryType: "authenticated",
      format: "mp4",
    };
    plan.exercises[0].clientFeedbackVideo = privateMedia;
    await plan.save();

    const response = await withAuth(
      request(app)
        .put(`/api/coaching/my-plans/${plan.dateString}/feedback`)
        .send({
          exercises: [{
            exerciseId: plan.exercises[0]._id,
            completed: true,
            clientFeedbackVideo: "https://signed.example.test/expired",
          }],
        }),
      clientAccount.accessToken,
    );

    expect(response.status).toBe(200);
    const stored = await CoachingDay.findById(plan._id).lean();
    expect(stored.exercises[0].clientFeedbackVideo).toEqual(privateMedia);
  });

  it("removes feedback through an ownership-checked action and cleans media", async () => {
    const clientAccount = await createTestUser({
      email: "coaching-remove-video-client@example.com",
    });
    const trainerAccount = await createTestUser({
      email: "coaching-remove-video-trainer@example.com",
      role: "trainer",
    });
    const plan = await createPlan({
      client: clientAccount.user,
      trainer: trainerAccount.user,
    });
    const exerciseId = plan.exercises[0]._id;
    plan.exercises[0].clientFeedbackVideo = {
      provider: "cloudinary",
      storageKey: "htcoaching/coaching-feedback-private/remove-review",
      resourceType: "video",
      deliveryType: "authenticated",
      format: "mp4",
    };
    plan.exercises[0].completed = true;
    await plan.save();

    const response = await withAuth(
      request(app).delete(
        `/api/coaching/my-plans/${plan.dateString}/exercises/${exerciseId}/feedback-video`,
      ),
      clientAccount.accessToken,
    );

    expect(response.status).toBe(200);
    const stored = await CoachingDay.findById(plan._id).lean();
    expect(stored.exercises[0].clientFeedbackVideo).toBe("");
    await expect(
      AccountDeletionMediaJob.countDocuments({
        targetUserId: clientAccount.user._id,
        "asset.storageKey":
          "htcoaching/coaching-feedback-private/remove-review",
        status: "pending",
      }),
    ).resolves.toBe(1);
    expect(mediaAdapter.destroySpy).not.toHaveBeenCalled();
    await processAccountDeletionMediaJobs({
      targetUserId: clientAccount.user._id,
    });
    expect(mediaAdapter.destroySpy).toHaveBeenCalledWith(
      "htcoaching/coaching-feedback-private/remove-review",
      "authenticated",
    );
  });

  it("queues cleanup for the replaced feedback asset in the same DB transaction", async () => {
    const clientAccount = await createTestUser({
      email: "coaching-replace-video-client@example.com",
    });
    const trainerAccount = await createTestUser({
      email: "coaching-replace-video-trainer@example.com",
      role: "trainer",
    });
    const plan = await createPlan({
      client: clientAccount.user,
      trainer: trainerAccount.user,
    });
    const exerciseId = plan.exercises[0]._id;
    plan.exercises[0].clientFeedbackVideo = {
      provider: "cloudinary",
      storageKey: "htcoaching/coaching-feedback-private/replaced-review",
      resourceType: "video",
      deliveryType: "authenticated",
      format: "mp4",
    };
    await plan.save();

    const response = await withAuth(
      request(app)
        .post(
          `/api/coaching/my-plans/${plan.dateString}/exercises/${exerciseId}/feedback-video`,
        )
        .attach("video", Buffer.from("replacement-video"), {
          filename: "replacement.mp4",
          contentType: "video/mp4",
        }),
      clientAccount.accessToken,
    );

    expect(response.status).toBe(200);
    await expect(
      AccountDeletionMediaJob.countDocuments({
        targetUserId: clientAccount.user._id,
        "asset.storageKey":
          "htcoaching/coaching-feedback-private/replaced-review",
        status: "pending",
      }),
    ).resolves.toBe(1);
    expect(mediaAdapter.destroySpy).not.toHaveBeenCalled();
    await processAccountDeletionMediaJobs({
      targetUserId: clientAccount.user._id,
    });
    expect(mediaAdapter.destroySpy).toHaveBeenCalledWith(
      "htcoaching/coaching-feedback-private/replaced-review",
      "authenticated",
    );
  });

  it("does not delete a legacy URL that belongs to another Cloudinary account", async () => {
    const clientAccount = await createTestUser({
      email: "coaching-unowned-remove-client@example.com",
    });
    const trainerAccount = await createTestUser({
      email: "coaching-unowned-remove-trainer@example.com",
      role: "trainer",
    });
    const plan = await createPlan({
      client: clientAccount.user,
      trainer: trainerAccount.user,
    });
    const exerciseId = plan.exercises[0]._id;
    plan.exercises[0].clientFeedbackVideo =
      "https://res.cloudinary.com/other-account/video/upload/v1/htcoaching/coaching-videos/shared-target.mp4";
    await plan.save();

    const response = await withAuth(
      request(app).delete(
        `/api/coaching/my-plans/${plan.dateString}/exercises/${exerciseId}/feedback-video`,
      ),
      clientAccount.accessToken,
    );

    expect(response.status).toBe(200);
    await expect(
      AccountDeletionMediaJob.countDocuments({
        targetUserId: clientAccount.user._id,
      }),
    ).resolves.toBe(0);
    expect(mediaAdapter.destroyLegacyPublicSpy).not.toHaveBeenCalled();
    expect((await CoachingDay.findById(plan._id)).exercises[0].clientFeedbackVideo).toBe("");
  });

  it("deletes an owned legacy URL through the verified media adapter", async () => {
    const clientAccount = await createTestUser({
      email: "coaching-owned-remove-client@example.com",
    });
    const trainerAccount = await createTestUser({
      email: "coaching-owned-remove-trainer@example.com",
      role: "trainer",
    });
    const plan = await createPlan({
      client: clientAccount.user,
      trainer: trainerAccount.user,
    });
    const exerciseId = plan.exercises[0]._id;
    plan.exercises[0].clientFeedbackVideo =
      "https://res.cloudinary.com/demo/video/upload/v1/htcoaching/coaching-videos/owned-remove.mp4";
    await plan.save();

    const response = await withAuth(
      request(app).delete(
        `/api/coaching/my-plans/${plan.dateString}/exercises/${exerciseId}/feedback-video`,
      ),
      clientAccount.accessToken,
    );

    expect(response.status).toBe(200);
    await expect(
      AccountDeletionMediaJob.countDocuments({
        targetUserId: clientAccount.user._id,
        "asset.storageKey": "htcoaching/coaching-videos/owned-remove",
        status: "pending",
      }),
    ).resolves.toBe(1);
    expect(mediaAdapter.destroyLegacyPublicSpy).not.toHaveBeenCalled();
    await processAccountDeletionMediaJobs({
      targetUserId: clientAccount.user._id,
    });
    expect(mediaAdapter.destroyLegacyPublicSpy).toHaveBeenCalledWith(
      "htcoaching/coaching-videos/owned-remove",
    );
  });

  it("does not delete authenticated metadata outside the coaching feedback folder", async () => {
    const clientAccount = await createTestUser({
      email: "coaching-foreign-private-client@example.com",
    });
    const trainerAccount = await createTestUser({
      email: "coaching-foreign-private-trainer@example.com",
      role: "trainer",
    });
    const plan = await createPlan({
      client: clientAccount.user,
      trainer: trainerAccount.user,
    });
    const exerciseId = plan.exercises[0]._id;
    plan.exercises[0].clientFeedbackVideo = {
      provider: "cloudinary",
      storageKey: "htcoaching/f1-private/foreign-asset",
      resourceType: "video",
      deliveryType: "authenticated",
      format: "mp4",
    };
    await plan.save();

    const detail = await withAuth(
      request(app).get(`/api/coaching/my-plans/${plan.dateString}`),
      clientAccount.accessToken,
    );
    const response = await withAuth(
      request(app).delete(
        `/api/coaching/my-plans/${plan.dateString}/exercises/${exerciseId}/feedback-video`,
      ),
      clientAccount.accessToken,
    );

    expect(detail.body.data.exercises[0].clientFeedbackVideo).toBe("");
    expect(response.status).toBe(200);
    expect(mediaAdapter.destroySpy).not.toHaveBeenCalled();
  });

  it("queues private media cleanup atomically when a coaching day is deleted", async () => {
    const clientAccount = await createTestUser({
      email: "coaching-delete-day-client@example.com",
    });
    const trainerAccount = await createTestUser({
      email: "coaching-delete-day-trainer@example.com",
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
    plan.clientFeedbackVideo = {
      provider: "cloudinary",
      storageKey: "htcoaching/coaching-feedback-private/deleted-day-review",
      resourceType: "video",
      deliveryType: "authenticated",
      format: "mp4",
    };
    await plan.save();

    const response = await withAuth(
      request(app).delete(
        `/api/coaching/trainer/clients/${clientAccount.user._id}/${plan.dateString}`,
      ),
      trainerAccount.accessToken,
    );

    expect(response.status).toBe(200);
    expect(await CoachingDay.findById(plan._id)).toBeNull();
    await expect(
      AccountDeletionMediaJob.countDocuments({
        targetUserId: clientAccount.user._id,
        "asset.storageKey":
          "htcoaching/coaching-feedback-private/deleted-day-review",
        status: "pending",
      }),
    ).resolves.toBe(1);
    expect(mediaAdapter.destroySpy).not.toHaveBeenCalled();
  });

  it("queues an owned legacy public video instead of orphaning it", async () => {
    const clientAccount = await createTestUser({
      email: "coaching-delete-legacy-client@example.com",
    });
    const trainerAccount = await createTestUser({
      email: "coaching-delete-legacy-trainer@example.com",
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
    plan.clientFeedbackVideo =
      "https://res.cloudinary.com/demo/video/upload/v1/htcoaching/coaching-videos/legacy-delete.mp4";
    await plan.save();

    const response = await withAuth(
      request(app).delete(
        `/api/coaching/trainer/clients/${clientAccount.user._id}/${plan.dateString}`,
      ),
      trainerAccount.accessToken,
    );

    expect(response.status).toBe(200);
    await expect(
      AccountDeletionMediaJob.countDocuments({
        targetUserId: clientAccount.user._id,
        "asset.storageKey": "htcoaching/coaching-videos/legacy-delete",
        "asset.deliveryType": "upload",
        status: "pending",
      }),
    ).resolves.toBe(1);
    expect(mediaAdapter.destroyLegacyPublicSpy).not.toHaveBeenCalled();
  });
});
