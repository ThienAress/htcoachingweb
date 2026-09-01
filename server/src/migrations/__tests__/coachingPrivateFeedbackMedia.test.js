import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearCollections,
  createTestUser,
  setupTestDB,
  teardownTestDB,
} from "../../__tests__/setup.js";
import CoachingDay from "../../models/CoachingDay.js";
import {
  authorizeCoachingMediaDryRunTarget,
  inspectLegacyCoachingFeedbackMedia,
  summarizeLegacyCoachingFeedbackMedia,
} from "../20260828-coaching-private-feedback-media.js";

const originalCloudName = process.env.CLOUDINARY_CLOUD_NAME;

beforeAll(async () => {
  process.env.CLOUDINARY_CLOUD_NAME = "demo";
  await setupTestDB();
});
afterEach(clearCollections);
afterAll(async () => {
  process.env.CLOUDINARY_CLOUD_NAME = originalCloudName;
  await teardownTestDB();
});

describe("Coaching private feedback media dry-run migration", () => {
  it("reports legacy strings without modifying private metadata", async () => {
    await clearCollections();
    const { user: client } = await createTestUser({
      email: "coaching-migration-client@example.com",
    });
    const { user: trainer } = await createTestUser({
      email: "coaching-migration-trainer@example.com",
      role: "trainer",
    });
    const plan = await CoachingDay.create({
      userId: client._id,
      trainerId: trainer._id,
      dateString: "2026-08-28",
      date: new Date("2026-08-28T00:00:00.000Z"),
      title: "Migration inventory",
      clientFeedbackVideo: "/uploads/legacy-feedback.mp4",
      exercises: [
        {
          name: "Legacy",
          clientFeedbackVideo:
            "https://res.cloudinary.com/demo/video/upload/v1/htcoaching/coaching-videos/legacy.mp4",
        },
        {
          name: "Private",
          clientFeedbackVideo: {
            provider: "cloudinary",
            storageKey: "htcoaching/coaching-feedback-private/private",
            resourceType: "video",
            deliveryType: "authenticated",
            format: "mp4",
          },
        },
        {
          name: "Foreign Cloud",
          clientFeedbackVideo:
            "https://res.cloudinary.com/foreign/video/upload/v1/htcoaching/coaching-videos/foreign.mp4",
        },
      ],
    });

    const first = await inspectLegacyCoachingFeedbackMedia();
    const second = await inspectLegacyCoachingFeedbackMedia();

    expect(summarizeLegacyCoachingFeedbackMedia(first)).toEqual({
      total: 3,
      cloudinaryPublic: 1,
      legacyLocal: 1,
      externalUnknown: 1,
      cleanupPending: 0,
    });
    expect(second).toEqual(first);
    const stored = await CoachingDay.findById(plan._id).lean();
    expect(stored.exercises[1].clientFeedbackVideo.deliveryType).toBe(
      "authenticated",
    );
  });

  it("never exposes an apply path or modifies a legacy URL", async () => {
    await clearCollections();
    const { user: client } = await createTestUser({
      email: "coaching-migration-apply-client@example.com",
    });
    const { user: trainer } = await createTestUser({
      email: "coaching-migration-apply-trainer@example.com",
      role: "trainer",
    });
    const plan = await CoachingDay.create({
      userId: client._id,
      trainerId: trainer._id,
      dateString: "2026-08-29",
      date: new Date("2026-08-29T00:00:00.000Z"),
      title: "Migration apply",
      exercises: [{
        name: "Legacy",
        clientFeedbackVideo:
          "https://res.cloudinary.com/demo/video/upload/v1/htcoaching/coaching-videos/apply.mp4",
      }],
    });
    await inspectLegacyCoachingFeedbackMedia();
    const stored = await CoachingDay.findById(plan._id).lean();
    expect(stored.exercises[0].clientFeedbackVideo).toBe(
      "https://res.cloudinary.com/demo/video/upload/v1/htcoaching/coaching-videos/apply.mp4",
    );
  });

  it("rejects apply and requires matching read-only targets", () => {
    const env = {
      APP_ENV: "staging",
      MONGO_URI: "mongodb://127.0.0.1:27017/htcoaching_staging",
      MIGRATION_TARGET_DATABASE: "htcoaching_staging",
    };

    expect(() =>
      authorizeCoachingMediaDryRunTarget({
        args: new Set(["--target=staging", "--apply"]),
        env,
      }),
    ).toThrow("inventory-only");
    expect(() =>
      authorizeCoachingMediaDryRunTarget({
        args: new Set(["--target=production"]),
        env,
      }),
    ).toThrow("does not match APP_ENV");
  });
});
