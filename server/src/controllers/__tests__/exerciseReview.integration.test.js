import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import request from "supertest";

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import Exercise from "../../models/Exercise.js";
import ExerciseReview from "../../models/ExerciseReview.js";
import exerciseRoutes from "../../routes/exercise.routes.js";

let app;

beforeAll(async () => {
  await setupTestDB();
  await ExerciseReview.init();
  app = createTestApp();
  app.use("/api/exercises", exerciseRoutes);
});

afterEach(async () => {
  await clearCollections();
});

afterAll(async () => {
  await teardownTestDB();
});

const createExercise = () =>
  Exercise.create({ name: "Goblet Squat", muscleGroup: "Chân" });

describe("Exercise review API", () => {
  it("requires auth and CSRF, validates rating, then upserts one review per user", async () => {
    const exercise = await createExercise();
    const { user, accessToken } = await createTestUser({
      name: "Người tập thử",
      email: "exercise-review@example.test",
    });
    const endpoint = `/api/exercises/${exercise._id}/reviews`;

    expect((await request(app).put(endpoint).send({ rating: 5 })).status).toBe(401);
    expect(
      (
        await request(app)
          .put(endpoint)
          .set("Cookie", [`accessToken=${accessToken}`])
          .send({ rating: 5 })
      ).status,
    ).toBe(403);
    expect(
      (await withAuth(request(app).put(endpoint), accessToken).send({ rating: 6 })).status,
    ).toBe(400);

    const created = await withAuth(request(app).put(endpoint), accessToken).send({
      rating: 4,
      comment: "Hướng dẫn setup dễ làm theo.",
    });
    expect(created.status).toBe(200);
    expect(created.body.data).toMatchObject({
      rating: 4,
      comment: "Hướng dẫn setup dễ làm theo.",
      displayName: "Người tập thử",
      isOwner: true,
    });

    await withAuth(request(app).put(endpoint), accessToken).send({
      rating: 5,
      comment: "Đã tập lại và kiểm soát tốt hơn.",
    });
    expect(
      await ExerciseReview.countDocuments({
        exerciseId: exercise._id,
        userId: user._id,
      }),
    ).toBe(1);
  });

  it("returns a public-safe summary and keeps the viewer review separate", async () => {
    const exercise = await createExercise();
    const { user, accessToken } = await createTestUser({
      name: "Khách HT",
      email: "private-exercise-review@example.test",
    });
    await ExerciseReview.create({
      exerciseId: exercise._id,
      userId: user._id,
      rating: 5,
      comment: "Rất rõ ràng.",
    });
    const endpoint = `/api/exercises/${exercise._id}/reviews?limit=10&page=1`;

    const publicResponse = await request(app).get(endpoint);
    expect(publicResponse.body.data).toMatchObject({
      summary: { total: 1, averageRating: 5 },
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      myReview: null,
      items: [{ displayName: "Khách HT", rating: 5, isOwner: false }],
    });
    expect(JSON.stringify(publicResponse.body)).not.toContain(
      "private-exercise-review@example.test",
    );

    const authenticated = await withAuth(request(app).get(endpoint), accessToken);
    expect(authenticated.body.data.myReview).toMatchObject({
      rating: 5,
      isOwner: true,
    });
  });

  it("only deletes the signed-in user's own review and cascades on exercise delete", async () => {
    const exercise = await createExercise();
    const owner = await createTestUser({ email: "exercise-owner@example.test" });
    const other = await createTestUser({ email: "exercise-other@example.test" });
    const admin = await createTestUser({
      email: "exercise-review-admin@example.test",
      role: "admin",
    });
    await ExerciseReview.create({
      exerciseId: exercise._id,
      userId: owner.user._id,
      rating: 4,
    });
    const endpoint = `/api/exercises/${exercise._id}/reviews`;

    expect((await withAuth(request(app).delete(endpoint), other.accessToken)).status).toBe(404);
    expect(await ExerciseReview.countDocuments()).toBe(1);

    const deletedExercise = await withAuth(
      request(app).delete(`/api/exercises/${exercise._id}`),
      admin.accessToken,
    );
    expect(deletedExercise.status).toBe(200);
    expect(await ExerciseReview.countDocuments()).toBe(0);
  });
});
