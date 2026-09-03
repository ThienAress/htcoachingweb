import { describe, expect, it, vi } from "vitest";

import { SEARCH_INDEX_EXERCISES } from "../../../../client/src/seo/searchIndexCohort.js";
import {
  PLAN_043_FIXTURE_KEY,
  createStagingSearchIndexCohortPlanDigest,
  runStagingSearchIndexCohortSync,
  validateStagingSearchIndexCohortAuthorization,
} from "../stagingSearchIndexCohortSync.js";

const NOW = new Date("2026-09-02T12:00:00.000Z");
const validStagingEnvironment = () => ({
  APP_ENV: "staging",
  MIGRATION_TARGET_DATABASE: "htcoaching_staging",
  MONGO_URI:
    "mongodb+srv://cluster.example/htcoaching_staging?retryWrites=true",
  CLIENT_URL: "https://staging--htcoachingweb.netlify.app",
  PUBLIC_API_ORIGIN: "https://htcoachingweb-staging.onrender.com",
  ALLOWED_ORIGINS: "https://staging--htcoachingweb.netlify.app",
  BACKGROUND_JOBS_ENABLED: "false",
  MORNING_HEALTH_REMINDER_ENABLED: "false",
  EMAIL_DELIVERY_MODE: "disabled",
  F1_RETENTION_ENFORCE: "false",
  NETLIFY_BUILD_HOOK_URL: "",
});
const instruction = (position) => ({
  title: `Bước ${position}`,
  description:
    "Giữ thân người ổn định, kiểm soát nhịp thở và thực hiện toàn bộ biên độ chuyển động một cách chậm rãi, chính xác.",
});
const sourceExercises = () =>
  SEARCH_INDEX_EXERCISES.map(({ id, name }, position) => ({
    _id: id,
    name,
    muscleGroup: "Nhóm cơ kiểm thử",
    description:
      `Bài tập số ${position + 1} có mô tả kỹ thuật đầy đủ để người tập hiểu tư thế chuẩn, cách kiểm soát chuyển động, nhịp thở và các lỗi thường gặp trong mỗi lần thực hiện.`,
    videoUrl: "https://res.cloudinary.com/demo/video/upload/exercise.mp4",
    imageUrl: "https://static.exercisedb.dev/media/exercise.gif",
    instructions: [instruction(1), instruction(2), instruction(3)],
    technicalDifficulty: {
      coordination: 1,
      stability: 1,
      mobility: 1,
      setup: 1,
      errorConsequence: 1,
      rationale: "Rubric đầy đủ cho quality gate.",
    },
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
  }));
const targetExercises = () =>
  SEARCH_INDEX_EXERCISES.filter(({ name }) =>
    new Set([
      "Assisted Pull-up",
      "Barbell Bench Press",
      "Barbell Deadlift",
    ]).has(name),
  ).map(({ name }, index) => ({
    _id: `00000000000000000000000${index + 1}`,
    name,
    muscleGroup: "Fixture cũ",
    _testCatalogFixture: {
      managed: true,
      key: PLAN_043_FIXTURE_KEY,
      version: "2026-08-11-v1",
    },
  }));
const dependenciesFor = ({ source, target, applyPlan = vi.fn() }) => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  assertConnectedTarget: vi.fn(),
  loadSourceExercises: vi.fn().mockResolvedValue(source),
  loadTargetState: vi.fn().mockResolvedValue({
    targetExercises: target,
    reviewCounts: {},
  }),
  applyPlan,
});

describe("staging Search cohort plan digest", () => {
  it("is stable when source and target query order changes", () => {
    const source = sourceExercises();
    const target = targetExercises();
    const digest = (sourceRows, targetRows) =>
      createStagingSearchIndexCohortPlanDigest({
        operation: "sync",
        sourceExercises: sourceRows,
        targetExercises: targetRows,
      });

    expect(digest(source, target)).toBe(
      digest([...source].reverse(), [...target].reverse()),
    );
  });

  it("returns a reviewable SHA-256 digest from preflight", async () => {
    const result = await runStagingSearchIndexCohortSync({
      argv: ["--target=staging"],
      env: validStagingEnvironment(),
      dependencies: dependenciesFor({
        source: sourceExercises(),
        target: targetExercises(),
      }),
      now: NOW,
    });

    expect(result.planDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it("accepts the reviewed digest as a one-time CLI argument", () => {
    const digest = "a".repeat(64);
    const result = validateStagingSearchIndexCohortAuthorization({
      argv: [
        "--target=staging",
        "--apply",
        "--confirm-search-index-cohort",
        `--expected-plan-digest=${digest}`,
      ],
      env: {
        ...validStagingEnvironment(),
        CONFIRM_STAGING_SEARCH_INDEX_COHORT_SYNC: "yes",
      },
    });

    expect(result.expectedPlanDigest).toBe(digest);
  });

  it.each([
    ["missing", [], {}, "STAGING_SEARCH_COHORT_PLAN_DIGEST_REQUIRED"],
    [
      "malformed",
      ["--expected-plan-digest=not-a-digest"],
      {},
      "STAGING_SEARCH_COHORT_PLAN_DIGEST_INVALID",
    ],
    [
      "conflicting",
      [`--expected-plan-digest=${"a".repeat(64)}`],
      { STAGING_SEARCH_INDEX_COHORT_EXPECTED_PLAN_DIGEST: "b".repeat(64) },
      "STAGING_SEARCH_COHORT_PLAN_DIGEST_CONFLICT",
    ],
  ])("rejects a %s apply digest before connecting", async (_, extraArgs, extraEnv, code) => {
    const connect = vi.fn();
    const error = await runStagingSearchIndexCohortSync({
      argv: [
        "--target=staging",
        "--apply",
        "--confirm-search-index-cohort",
        ...extraArgs,
      ],
      env: {
        ...validStagingEnvironment(),
        CONFIRM_STAGING_SEARCH_INDEX_COHORT_SYNC: "yes",
        ...extraEnv,
      },
      dependencies: { connect },
    }).catch((caught) => caught);

    expect({ code: error.code, connectCalls: connect.mock.calls.length }).toEqual({
      code,
      connectCalls: 0,
    });
  });

  it("rejects a stale reviewed digest before apply writes", async () => {
    const source = sourceExercises();
    const target = targetExercises();
    const preflight = await runStagingSearchIndexCohortSync({
      argv: ["--target=staging"],
      env: validStagingEnvironment(),
      dependencies: dependenciesFor({ source, target }),
      now: NOW,
    });
    const changedSource = structuredClone(source);
    changedSource[0].description += " Nội dung nguồn đã thay đổi sau preflight.";
    const applyPlan = vi.fn();
    const error = await runStagingSearchIndexCohortSync({
      argv: [
        "--target=staging",
        "--apply",
        "--confirm-search-index-cohort",
      ],
      env: {
        ...validStagingEnvironment(),
        CONFIRM_STAGING_SEARCH_INDEX_COHORT_SYNC: "yes",
        STAGING_SEARCH_INDEX_COHORT_EXPECTED_PLAN_DIGEST:
          preflight.planDigest,
      },
      dependencies: dependenciesFor({
        source: changedSource,
        target,
        applyPlan,
      }),
      now: new Date("2026-09-02T12:05:00.000Z"),
    }).catch((caught) => caught);

    expect({ code: error.code, applyCalls: applyPlan.mock.calls.length }).toEqual({
      code: "STAGING_SEARCH_COHORT_PLAN_DIGEST_MISMATCH",
      applyCalls: 0,
    });
  });

  it("still verifies the committed post-transaction state", async () => {
    const source = sourceExercises();
    const target = targetExercises();
    const preflight = await runStagingSearchIndexCohortSync({
      argv: ["--target=staging"],
      env: validStagingEnvironment(),
      dependencies: dependenciesFor({ source, target }),
      now: NOW,
    });
    const applyPlan = vi.fn().mockResolvedValue({ appliedOperationCount: 13 });
    const dependencies = dependenciesFor({ source, target, applyPlan });
    const error = await runStagingSearchIndexCohortSync({
      argv: [
        "--target=staging",
        "--apply",
        "--confirm-search-index-cohort",
      ],
      env: {
        ...validStagingEnvironment(),
        CONFIRM_STAGING_SEARCH_INDEX_COHORT_SYNC: "yes",
        STAGING_SEARCH_INDEX_COHORT_EXPECTED_PLAN_DIGEST:
          preflight.planDigest,
      },
      dependencies,
      now: new Date("2026-09-02T12:05:00.000Z"),
    }).catch((caught) => caught);

    expect({
      code: error.code,
      applyCalls: applyPlan.mock.calls.length,
      stateLoads: dependencies.loadTargetState.mock.calls.length,
    }).toEqual({
      code: "STAGING_SEARCH_COHORT_POST_VERIFY_FAILED",
      applyCalls: 1,
      stateLoads: 2,
    });
  });
});
