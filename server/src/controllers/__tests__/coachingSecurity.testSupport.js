import { Writable } from "stream";
import { vi } from "vitest";

import { createTestApp } from "../../__tests__/setup.js";
import { errorHandler } from "../../middlewares/errorHandler.js";
import CoachingDay from "../../models/CoachingDay.js";
import Order from "../../models/Order.js";
import coachingRoutes from "../../routes/coaching.routes.js";
import { setCoachingPrivateMediaAdapterForTests } from "../../services/coachingPrivateMedia.service.js";

export const createCoachingSecurityTestApp = () => {
  const app = createTestApp();
  app.use("/api/coaching", coachingRoutes);
  app.use(errorHandler);
  return app;
};

export const installPrivateMediaAdapter = () => {
  const state = {
    uploadedBytes: 0,
    uploadOptions: null,
    uploadStreamSpy: null,
    destroySpy: vi.fn().mockResolvedValue({ result: "ok" }),
    destroyLegacyPublicSpy: vi.fn().mockResolvedValue({ deleted: true }),
  };
  state.uploadStreamSpy = vi.fn((options, callback) => {
    state.uploadOptions = options;
    state.uploadedBytes = 0;
    return new Writable({
      write(chunk, _encoding, done) {
        state.uploadedBytes += chunk.length;
        done();
      },
      final(done) {
        callback(null, {
          public_id: "htcoaching/coaching-feedback-private/client-review",
          secure_url:
            "https://res.cloudinary.com/demo/video/authenticated/client-review.mp4",
          bytes: state.uploadedBytes,
          format: "mp4",
          version: 42,
        });
        done();
      },
    });
  });
  setCoachingPrivateMediaAdapterForTests({
    uploadStream: state.uploadStreamSpy,
    destroy: state.destroySpy,
    destroyLegacyPublic: state.destroyLegacyPublicSpy,
    getSignedReadUrl: vi.fn((media) =>
      `https://signed.example.test/${encodeURIComponent(media.storageKey)}?expires=300`,
    ),
  });
  return state;
};

export const createAssignment = async ({ client, trainer }) =>
  Order.create({
    userId: client._id,
    trainerId: trainer._id,
    name: client.name,
    email: client.email,
    package: "PT",
    sessions: 3,
    totalSessions: 3,
    status: "approved",
  });

export const createPlan = async ({
  client,
  trainer,
  dateString = "2026-08-28",
}) =>
  CoachingDay.create({
    userId: client._id,
    trainerId: trainer._id,
    dateString,
    date: new Date(`${dateString}T00:00:00.000Z`),
    title: "Private feedback test",
    exercises: [{ name: "Squat" }],
  });
