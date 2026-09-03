import { describe, expect, it, vi } from "vitest";
import { SEARCH_INDEX_EXERCISES } from "../../../../client/src/seo/searchIndexCohort.js";
import {
  PLAN_043_FIXTURE_KEY,
  STAGING_SEARCH_COHORT_FIXTURE_KEY,
  STAGING_SEARCH_INDEX_EXERCISES,
  applyStagingSearchIndexCohortPlan,
  buildStagingSearchIndexCohortPlan,
  runStagingSearchIndexCohortSync,
  validateStagingSearchIndexCohortAuthorization,
  verifyStagingSearchIndexCohortPostState,
} from "../stagingSearchIndexCohortSync.js";
const NOW = new Date("2026-09-02T12:00:00.000Z");
const OVERLAPPING_PLAN_043_NAMES = new Set([
  "Assisted Pull-up", "Barbell Bench Press", "Barbell Deadlift",
]);
const validStagingEnvironment = () => ({
  APP_ENV: "staging", MIGRATION_TARGET_DATABASE: "htcoaching_staging",
  MONGO_URI:
    "mongodb+srv://cluster.example/htcoaching_staging?retryWrites=true",
  CLIENT_URL: "https://staging--htcoachingweb.netlify.app",
  PUBLIC_API_ORIGIN: "https://htcoachingweb-staging.onrender.com",
  ALLOWED_ORIGINS: "https://staging--htcoachingweb.netlify.app",
  BACKGROUND_JOBS_ENABLED: "false", MORNING_HEALTH_REMINDER_ENABLED: "false",
  EMAIL_DELIVERY_MODE: "disabled", F1_RETENTION_ENFORCE: "false",
  NETLIFY_BUILD_HOOK_URL: "",
});
const authorize = (argv, env = validStagingEnvironment()) =>
  validateStagingSearchIndexCohortAuthorization({ argv, env });
const instruction = (position) => ({
  title: `Bước ${position}`,
  description:
    "Giữ thân người ổn định, kiểm soát nhịp thở và thực hiện toàn bộ biên độ chuyển động một cách chậm rãi, chính xác.",
});
const sourceExercise = ({ id, name }, position = 0) => ({
  _id: id, name, muscleGroup: "Nhóm cơ kiểm thử",
  description:
    `Bài tập số ${position + 1} có mô tả kỹ thuật đầy đủ để người tập hiểu tư thế chuẩn, cách kiểm soát chuyển động, nhịp thở và các lỗi thường gặp trong mỗi lần thực hiện.`,
  videoUrl: "https://res.cloudinary.com/demo/video/upload/exercise.mp4",
  videoPublicId: "must-not-copy",
  imageUrl: "https://static.exercisedb.dev/media/exercise.gif",
  instructions: [instruction(1), instruction(2), instruction(3)],
  technicalDifficulty: {
    coordination: 1, stability: 1, mobility: 1, setup: 1, errorConsequence: 1,
    rationale: "Rubric đầy đủ cho quality gate.", mustNotCopy: "private-extension",
  },
  technicalDifficultyRating: 3, _testCatalogFixture: { key: "must-not-copy" },
  createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-02T00:00:00.000Z",
});
const sourceExercises = () => SEARCH_INDEX_EXERCISES.map(sourceExercise);
const plan043Collisions = () =>
  SEARCH_INDEX_EXERCISES.filter(({ name }) =>
    OVERLAPPING_PLAN_043_NAMES.has(name),
  ).map(({ name }, index) => ({
    _id: `00000000000000000000000${index + 1}`,
    name,
    muscleGroup: "Fixture cũ",
    _testCatalogFixture: { managed: true, key: PLAN_043_FIXTURE_KEY, version: "2026-08-11-v1" },
  }));
const applyPlanInMemory = (targetExercises, plan) => {
  const byId = new Map(targetExercises.map((item) => [String(item._id), item]));
  for (const operation of plan.operations) {
    if (operation.type === "displace") {
      byId.set(operation.id, {
        ...byId.get(operation.id),
        name: operation.displacedName,
        _testCatalogFixture: undefined,
        _stagingSearchIndexCohortDisplaced: operation.marker,
      });
    }
    if (operation.type === "insert") {
      byId.set(operation.id, operation.document);
    }
  }
  return [...byId.values()];
};
const buildSyncPlan = (targetExercises = plan043Collisions()) =>
  buildStagingSearchIndexCohortPlan({
    operation: "sync", sourceExercises: sourceExercises(), targetExercises, now: NOW,
  });
const syncedState = () => {
  const original = plan043Collisions();
  const plan = buildSyncPlan(original);
  return { plan, targetExercises: applyPlanInMemory(original, plan) };
};
const buildRollbackPlan = (targetExercises, reviewCounts = {}) =>
  buildStagingSearchIndexCohortPlan({
    operation: "rollback", targetExercises, reviewCounts,
  });
describe("staging Search cohort authorization", () => {
  it("keeps the server-local deployable allowlist aligned with the client cohort", () =>
    expect(STAGING_SEARCH_INDEX_EXERCISES).toEqual(SEARCH_INDEX_EXERCISES));
  it("allows a read-only staging preflight without mutation confirmation", () => {
    expect(authorize(["--target=staging"])).toMatchObject({
      apply: false, operation: "sync",
    });
  });
  it("rejects an apply without both the dedicated flag and environment confirmation", () => {
    expect(() => authorize(["--target=staging", "--apply"])
    ).toThrowError(/STAGING_SEARCH_COHORT_APPLY_CONFIRMATION_REQUIRED/);
  });
  it("rejects every non-staging target before a connection is opened", () => {
    expect(() => authorize(["--target=production"], {
      ...validStagingEnvironment(), APP_ENV: "production",
    })
    ).toThrowError(/STAGING_SEARCH_COHORT_TARGET_REQUIRED/);
  });
});
describe("staging Search cohort planning", () => {
  it("plans three reversible displacements and ten exact-id inserts", () => {
    const plan = buildSyncPlan();
    expect(plan.summary).toEqual({
      displace: 3, insert: 10, update: 0, delete: 0, restore: 0, unchanged: 0,
    });
  });
  it("copies only the approved Exercise fields and fixture ownership metadata", () => {
    const plan = buildSyncPlan();
    const inserted = plan.operations.find(
      (item) => item.type === "insert" && item.document.name === "3/4 Sit-up",
    ).document;
    expect(inserted).toMatchObject({
      _id: "6a4b43515b0a4f47f1108990",
      name: "3/4 Sit-up",
      _stagingSearchIndexCohortFixture: { managed: true, key: STAGING_SEARCH_COHORT_FIXTURE_KEY },
    });
    expect(inserted).not.toHaveProperty("videoPublicId");
    expect(inserted).not.toHaveProperty("technicalDifficultyRating");
    expect(inserted).not.toHaveProperty("technicalDifficulty.mustNotCopy");
    expect(inserted).not.toHaveProperty("_testCatalogFixture");
  });
  it("does not transfer Plan 043 cleanup ownership to a pinned replacement", () => {
    const plan = buildSyncPlan();
    const replacement = plan.operations.find(
      (item) =>
        item.type === "insert" && item.document.name === "Assisted Pull-up",
    ).document;
    expect(replacement).not.toHaveProperty("_testCatalogFixture");
  });
  it("fails closed on an unmanaged same-name collision", () => {
    const unmanaged = { _id: "000000000000000000000099", name: "Dumbbell Burpee" };
    expect(() => buildSyncPlan([unmanaged])).toThrowError(
      /STAGING_SEARCH_COHORT_NAME_COLLISION/,
    );
  });
  it("fails closed when a pinned ObjectId is already owned by another document", () => {
    const occupied = { ...sourceExercise(SEARCH_INDEX_EXERCISES[0]),
      name: "Unrelated staging document" };
    expect(() => buildSyncPlan([occupied])).toThrowError(
      /STAGING_SEARCH_COHORT_TARGET_ID_OCCUPIED/,
    );
  });
  it("rejects normalized duplicate source descriptions before planning writes", () => {
    const duplicateSource = sourceExercises();
    duplicateSource[1].description = duplicateSource[0].description;
    expect(() =>
      buildStagingSearchIndexCohortPlan({
        operation: "sync", sourceExercises: duplicateSource,
        targetExercises: plan043Collisions(), now: NOW,
      }),
    ).toThrowError(/STAGING_SEARCH_COHORT_SOURCE_DESCRIPTION_DUPLICATE/);
  });
  it("is a no-op when every exact-id fixture already matches its source hash", () => {
    const { targetExercises } = syncedState();
    const rerun = buildSyncPlan(targetExercises);
    expect([rerun.summary.unchanged, rerun.operations.length]).toEqual([10, 0]);
  });
  it("plans rollback only when exact-id fixtures have no reviews or content drift", () => {
    const { targetExercises } = syncedState();
    const rollback = buildRollbackPlan(targetExercises);
    expect(rollback.summary).toMatchObject({ delete: 10, restore: 3 });
    expect(() => buildRollbackPlan(
      targetExercises, { "6a4b43515b0a4f47f1108990": 1 },
    )
    ).toThrowError(/STAGING_SEARCH_COHORT_ROLLBACK_REVIEWS_EXIST/);
  });
  it("rejects rollback before mutation when a reversible displacement is missing", () => {
    const { plan, targetExercises } = syncedState();
    const displacedName = plan.operations.find(
      ({ type }) => type === "displace",
    ).displacedName;
    const incomplete = targetExercises.filter(
      (item) => item.name !== displacedName,
    );
    expect(() => buildRollbackPlan(incomplete)).toThrowError(
      /STAGING_SEARCH_COHORT_ROLLBACK_DISPLACEMENT_DRIFT/,
    );
  });
  it("rejects rollback post-verification when a review appears during the transaction race window", () => {
    expect(() =>
      verifyStagingSearchIndexCohortPostState({
        operation: "rollback",
        targetExercises: plan043Collisions(),
        reviewCounts: { [SEARCH_INDEX_EXERCISES[0].id]: 1 },
      }),
    ).toThrowError(/rollback left reviews for a removed Plan 079 fixture/i);
  });
  it("rejects a foreign displacement marker before planning sync writes", () => {
    const targetExercises = [
      ...plan043Collisions(),
      {
        _id: "000000000000000000000098",
        name: "__plan079_displaced__foreign",
        _stagingSearchIndexCohortDisplaced: {
          managed: true, key: STAGING_SEARCH_COHORT_FIXTURE_KEY,
          replacementId: SEARCH_INDEX_EXERCISES[0].id,
          originalName: SEARCH_INDEX_EXERCISES[0].name,
          displacedName: "__plan079_displaced__foreign",
        },
      },
    ];
    expect(() => buildSyncPlan(targetExercises)).toThrowError(
      /STAGING_SEARCH_COHORT_DISPLACEMENT_DRIFT/,
    );
  });
});
describe("staging Search cohort run seam", () => {
  it("keeps preflight read-only and delegates apply only after authorization", async () => {
    const applyPlan = vi.fn();
    const dependencies = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      assertConnectedTarget: vi.fn(),
      loadSourceExercises: vi.fn().mockResolvedValue(sourceExercises()),
      loadTargetState: vi.fn().mockResolvedValue({
        targetExercises: plan043Collisions(),
        reviewCounts: {},
      }),
      applyPlan,
    };
    const result = await runStagingSearchIndexCohortSync({
      argv: ["--target=staging"],
      env: validStagingEnvironment(),
      dependencies,
      now: NOW,
    });
    expect(result.mode).toBe("preflight");
    expect(applyPlan).not.toHaveBeenCalled();
    expect(dependencies.disconnect).toHaveBeenCalledOnce();
  });
});
describe("staging Search cohort Mongo adapter", () => {
  const rollbackRaces = [
    ["reviews created after preflight", "delete", 1, /STAGING_SEARCH_COHORT_ROLLBACK_REVIEWS_EXIST/],
    ["content changed after preflight", "delete", 0, /STAGING_SEARCH_COHORT_ROLLBACK_CONTENT_DRIFT/],
    ["content changed before update", "update", 0, /STAGING_SEARCH_COHORT_TARGET_CONTENT_DRIFT/],
  ];
  it.each(rollbackRaces)(
    "rejects %s before transactional write",
    async (_, type, reviews, error) => {
    const source = sourceExercises()[0];
    const inserted = buildSyncPlan().operations.find(
      ({ type, id }) => type === "insert" && id === source._id,
    );
    const exerciseCollection = { findOne: vi.fn().mockResolvedValue({
        ...source,
        description: `${source.description} Nội dung vừa bị thay đổi.`,
      }),
      deleteOne: vi.fn(), updateOne: vi.fn(),
    };
    const reviewCollection = { countDocuments: vi.fn().mockResolvedValue(reviews) };
    const session = { withTransaction: vi.fn((callback) => callback()), endSession: vi.fn() };
    const connection = {
      startSession: vi.fn().mockResolvedValue(session),
      collection: vi.fn().mockReturnValueOnce(exerciseCollection).mockReturnValueOnce(reviewCollection),
    };
      await expect(applyStagingSearchIndexCohortPlan({
        plan: { operations: [{
          type, id: source._id, document: inserted.document,
          expectedSourceHash:
            inserted.document._stagingSearchIndexCohortFixture.sourceHash,
        }] },
        connection,
      })).rejects.toThrowError(error);
      expect(exerciseCollection[`${type}One`]).not.toHaveBeenCalled();
      expect(session.endSession).toHaveBeenCalledOnce();
    },
  );
});
