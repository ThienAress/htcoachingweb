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

vi.mock("../../utils/sendMail.js", () => ({
  sendCheckinMail: vi.fn(),
}));

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import { protect } from "../../middlewares/auth.middleware.js";
import User from "../../models/User.js";
import Recipe from "../../models/Recipe.js";
import CoachingDay from "../../models/CoachingDay.js";
import Checkin from "../../models/Checkin.js";
import Order from "../../models/Order.js";
import Contract from "../../models/Contract.js";
import F1Intake from "../../models/F1Intake.js";
import {
  createCheckin,
  deleteCheckin,
  getMyCheckins,
} from "../checkin.controller.js";
import {
  getBookmarkedRecipes,
  getRecipeAreas,
  getRecipeBySlug,
  getRecipeCategories,
  addBookmark,
  removeBookmark,
  toggleBookmark,
} from "../recipe.controller.js";
import {
  submitFeedback,
  upsertCoachingDay,
} from "../coaching.controller.js";
import { refreshTokenController } from "../auth.controller.js";
import { getOrCreateDraftIntake } from "../f1Customer/intake.helpers.js";

let app;

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();

  app.get("/api/checkin/me", protect, getMyCheckins);
  app.post(
    "/api/checkin",
    protect,
    (req, _res, next) => {
      req.isAdmin = true;
      next();
    },
    createCheckin,
  );
  app.delete(
    "/api/checkin/:id",
    protect,
    (req, _res, next) => {
      req.isAdmin = true;
      next();
    },
    deleteCheckin,
  );
  app.get("/api/recipes/categories", getRecipeCategories);
  app.get("/api/recipes/areas", getRecipeAreas);
  app.get("/api/recipes/detail/:slug", getRecipeBySlug);
  app.get("/api/recipes/bookmarks", protect, getBookmarkedRecipes);
  app.post(
    "/api/recipes/bookmarks/:recipeId",
    protect,
    toggleBookmark,
  );
  app.put(
    "/api/recipes/bookmarks/:recipeId",
    protect,
    addBookmark,
  );
  app.delete(
    "/api/recipes/bookmarks/:recipeId",
    protect,
    removeBookmark,
  );
  app.post("/api/auth/refresh", refreshTokenController);
  app.put(
    "/api/coaching/my-plans/:dateString/feedback",
    protect,
    submitFeedback,
  );
  app.post(
    "/api/coaching/trainer/clients/:userId",
    protect,
    upsertCoachingDay,
  );
});

afterEach(async () => {
  await clearCollections();
});

afterAll(async () => {
  await teardownTestDB();
});

describe("Phase 0 security boundaries", () => {
  it("hides User secrets by default and never returns them from check-in", async () => {
    const { user, accessToken, refreshToken } = await createTestUser({
      email: "checkin-security@example.com",
    });

    const defaultSelection = await User.findById(user._id).lean();
    const explicitSecrets = await User.findById(user._id)
      .select("+password +refreshToken")
      .lean();

    expect(defaultSelection.password).toBeUndefined();
    expect(defaultSelection.refreshToken).toBeUndefined();
    expect(explicitSecrets.password).toBeTruthy();
    expect(explicitSecrets.refreshToken).toBeTruthy();

    const response = await withAuth(
      request(app).get("/api/checkin/me"),
      accessToken,
    );

    expect(response.status).toBe(200);
    expect(response.body.data.user).toEqual(
      expect.objectContaining({
        name: "Test User",
        email: "checkin-security@example.com",
      }),
    );
    expect(JSON.stringify(response.body)).not.toContain("password");
    expect(JSON.stringify(response.body)).not.toContain("refreshToken");

    const refreshResponse = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", [`refreshToken=${refreshToken}`]);

    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.data.token).toBeTruthy();
    expect(JSON.stringify(refreshResponse.body)).not.toContain("refreshToken");
  });

  it("keeps draft recipes out of public detail, taxonomy, and bookmarks", async () => {
    const published = await Recipe.create({
      name: "Published Recipe",
      slug: "published-recipe",
      category: "Public Category",
      area: "Public Area",
      isPublished: true,
    });
    const draft = await Recipe.create({
      name: "Draft Recipe",
      slug: "draft-recipe",
      category: "Draft Category",
      area: "Draft Area",
      isPublished: false,
    });
    const { user, accessToken } = await createTestUser({
      email: "recipe-security@example.com",
    });
    user.savedRecipes = [published._id, draft._id];
    await user.save();

    const publishedResponse = await request(app).get(
      "/api/recipes/detail/published-recipe",
    );
    const draftResponse = await request(app).get(
      "/api/recipes/detail/draft-recipe",
    );
    const categoriesResponse = await request(app).get(
      "/api/recipes/categories",
    );
    const areasResponse = await request(app).get("/api/recipes/areas");
    const bookmarksResponse = await withAuth(
      request(app).get("/api/recipes/bookmarks"),
      accessToken,
    );

    expect(publishedResponse.status).toBe(200);
    expect(draftResponse.status).toBe(404);
    expect(categoriesResponse.body.data).toEqual(["Public Category"]);
    expect(areasResponse.body.data).toEqual(["Public Area"]);
    expect(bookmarksResponse.body.data).toHaveLength(1);
    expect(bookmarksResponse.body.data[0].slug).toBe("published-recipe");

    const draftBookmarkResponse = await withAuth(
      request(app).post(`/api/recipes/bookmarks/${draft._id}`),
      accessToken,
    );
    expect(draftBookmarkResponse.status).toBe(404);
  });

  it("lets clients update feedback fields without changing trainer content", async () => {
    const { user: client, accessToken } = await createTestUser({
      email: "coaching-client@example.com",
    });
    const { user: trainer } = await createTestUser({
      email: "coaching-trainer@example.com",
      role: "trainer",
    });
    const plan = await CoachingDay.create({
      userId: client._id,
      trainerId: trainer._id,
      dateString: "2026-07-19",
      date: new Date("2026-07-19T00:00:00.000Z"),
      title: "Trainer Plan",
      exercises: [
        {
          name: "Squat",
          sets: 4,
          reps: "10",
          weight: "60kg",
        },
      ],
    });
    const exerciseId = plan.exercises[0]._id.toString();

    const response = await withAuth(
      request(app)
        .put("/api/coaching/my-plans/2026-07-19/feedback")
        .send({
          clientFeedbackText: "Session feedback",
          exercises: [
            {
              _id: exerciseId,
              name: "Injected exercise",
              sets: 999,
              reps: "999",
              weight: "999kg",
              videoUrl: "https://attacker.example/demo.mp4",
              completed: true,
              clientFeedbackNote: "Good form",
              clientFeedbackVideo:
                "https://res.cloudinary.com/demo/video/upload/v1/htcoaching/coaching-videos/review.mp4",
            },
          ],
        }),
      accessToken,
    );

    expect(response.status).toBe(200);
    const savedPlan = await CoachingDay.findById(plan._id);
    const savedExercise = savedPlan.exercises[0];

    expect(savedExercise.name).toBe("Squat");
    expect(savedExercise.sets).toBe(4);
    expect(savedExercise.reps).toBe("10");
    expect(savedExercise.weight).toBe("60kg");
    expect(savedExercise.videoUrl).toBe("");
    expect(savedExercise.completed).toBe(true);
    expect(savedExercise.clientFeedbackNote).toBe("Good form");
    expect(savedExercise.clientFeedbackVideo).toContain(
      "/htcoaching/coaching-videos/",
    );
  });

  it("makes check-in creation idempotent and refunds with an atomic increment", async () => {
    const { user: client } = await createTestUser({
      email: "idempotent-client@example.com",
    });
    const { user: trainer, accessToken } = await createTestUser({
      email: "idempotent-trainer@example.com",
      role: "admin",
    });
    const order = await Order.create({
      userId: client._id,
      trainerId: trainer._id,
      name: client.name,
      email: client.email,
      package: "PT 10",
      sessions: 2,
      totalSessions: 2,
      status: "approved",
    });
    await Checkin.init();
    const payload = {
      orderId: order._id.toString(),
      clientRequestId: "a26e93e8-8d21-4be2-9c6e-2ebf3cc340b1",
      time: "2026-07-19T08:00:00.000Z",
      muscle: "Legs",
      note: "Phase 1 test",
    };

    const [first, second] = await Promise.all([
      withAuth(request(app).post("/api/checkin").send(payload), accessToken),
      withAuth(request(app).post("/api/checkin").send(payload), accessToken),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await Checkin.countDocuments({ orderId: order._id })).toBe(1);
    expect((await Order.findById(order._id)).sessions).toBe(1);

    const savedCheckin = await Checkin.findOne({ orderId: order._id });
    const deleted = await withAuth(
      request(app).delete(`/api/checkin/${savedCheckin._id}`),
      accessToken,
    );
    const repeatedDelete = await withAuth(
      request(app).delete(`/api/checkin/${savedCheckin._id}`),
      accessToken,
    );

    expect(deleted.status).toBe(200);
    expect(repeatedDelete.status).toBe(404);
    expect((await Order.findById(order._id)).sessions).toBe(2);
  });

  it("preserves client coaching progress and rejects a stale trainer revision", async () => {
    const { user: client } = await createTestUser({
      email: "revision-client@example.com",
    });
    const { user: trainer, accessToken } = await createTestUser({
      email: "revision-trainer@example.com",
      role: "trainer",
    });
    await Order.create({
      userId: client._id,
      trainerId: trainer._id,
      status: "approved",
    });
    const plan = await CoachingDay.create({
      userId: client._id,
      trainerId: trainer._id,
      dateString: "2026-07-20",
      date: new Date("2026-07-20T00:00:00.000Z"),
      title: "Original plan",
      exercises: [
        {
          name: "Squat",
          sets: 4,
          reps: "10",
          weight: "60kg",
          completed: true,
          clientFeedbackNote: "Completed safely",
        },
      ],
    });
    const revision = plan.__v;
    const payload = {
      dateString: plan.dateString,
      title: "Updated plan",
      note: "Trainer update",
      revision,
      exercises: [
        {
          _id: plan.exercises[0]._id.toString(),
          name: "Back Squat",
          sets: 5,
          reps: "8",
          weight: "70kg",
        },
      ],
    };

    const updated = await withAuth(
      request(app)
        .post(`/api/coaching/trainer/clients/${client._id}`)
        .send(payload),
      accessToken,
    );
    const stale = await withAuth(
      request(app)
        .post(`/api/coaching/trainer/clients/${client._id}`)
        .send(payload),
      accessToken,
    );

    expect(updated.status).toBe(200);
    expect(updated.body.data.exercises[0].name).toBe("Back Squat");
    expect(updated.body.data.exercises[0].completed).toBe(true);
    expect(updated.body.data.exercises[0].clientFeedbackNote).toBe(
      "Completed safely",
    );
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe("COACHING_REVISION_CONFLICT");
  });

  it("enforces active Contract and latest F1 Intake uniqueness", async () => {
    const { user: client } = await createTestUser({
      email: "contract-client@example.com",
    });
    const { user: trainer } = await createTestUser({
      email: "contract-trainer@example.com",
      role: "trainer",
    });
    const order = await Order.create({
      userId: client._id,
      trainerId: trainer._id,
      status: "approved",
    });
    await Contract.init();
    const contract = await Contract.create({
      orderId: order._id,
      clientId: client._id,
      trainerId: trainer._id,
      clientInfo: { name: client.name },
    });

    await expect(
      Contract.create({
        orderId: order._id,
        clientId: client._id,
        trainerId: trainer._id,
        clientInfo: { name: client.name },
      }),
    ).rejects.toMatchObject({ code: 11000 });
    contract.status = "cancelled";
    await contract.save();
    await expect(
      Contract.create({
        orderId: order._id,
        clientId: client._id,
        trainerId: trainer._id,
        clientInfo: { name: client.name },
      }),
    ).resolves.toBeTruthy();

    await F1Intake.init();
    const customer = {
      _id: new Contract.base.Types.ObjectId(),
      fullName: "F1 Client",
      email: "f1@example.com",
    };
    const [intakeA, intakeB] = await Promise.all([
      getOrCreateDraftIntake(customer, trainer._id),
      getOrCreateDraftIntake(customer, trainer._id),
    ]);
    expect(String(intakeA._id)).toBe(String(intakeB._id));
    expect(
      await F1Intake.countDocuments({
        customerId: customer._id,
        isLatest: true,
      }),
    ).toBe(1);
  });

  it("supports idempotent Recipe bookmark PUT and DELETE", async () => {
    const recipe = await Recipe.create({
      name: "Atomic Bookmark Recipe",
      slug: "atomic-bookmark-recipe",
      isPublished: true,
    });
    const { user, accessToken } = await createTestUser({
      email: "bookmark-client@example.com",
    });

    await withAuth(
      request(app).put(`/api/recipes/bookmarks/${recipe._id}`),
      accessToken,
    );
    await withAuth(
      request(app).put(`/api/recipes/bookmarks/${recipe._id}`),
      accessToken,
    );
    expect((await User.findById(user._id)).savedRecipes).toHaveLength(1);

    await withAuth(
      request(app).delete(`/api/recipes/bookmarks/${recipe._id}`),
      accessToken,
    );
    await withAuth(
      request(app).delete(`/api/recipes/bookmarks/${recipe._id}`),
      accessToken,
    );
    expect((await User.findById(user._id)).savedRecipes).toHaveLength(0);
  });
});
