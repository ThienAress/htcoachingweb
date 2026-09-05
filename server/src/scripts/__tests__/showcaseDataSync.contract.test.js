import mongodb from "mongodb";
import { describe, expect, it } from "vitest";

import {
  LOCAL_SHOWCASE_DATABASE,
  LOCAL_SHOWCASE_MONGO_URI,
  PRODUCTION_SHOWCASE_DATABASE,
  SHOWCASE_TRAINER_SLUG,
  STAGING_SHOWCASE_DATABASE,
  sanitizeCustomerStory,
  sanitizeTrainer,
  validateShowcaseSyncContext,
} from "../showcaseDataSync.contract.js";

const { ObjectId } = mongodb;
const sourceUri =
  "mongodb+srv://readonly.example/gym-app?retryWrites=false";
const stagingUri =
  "mongodb+srv://staging.example/htcoaching_staging?retryWrites=true";
const localUri = "mongodb://127.0.0.1:27017/htcoaching_local";
const sourceEnv = {
  ACCOUNT_SYNC_SOURCE_ENV: "production",
  ACCOUNT_SYNC_SOURCE_READ_ONLY: "yes",
};

describe("showcase data sync environment guards", () => {
  it("pins the public trainer and the only permitted databases", () => {
    expect({
      slug: SHOWCASE_TRAINER_SLUG,
      production: PRODUCTION_SHOWCASE_DATABASE,
      staging: STAGING_SHOWCASE_DATABASE,
      local: LOCAL_SHOWCASE_DATABASE,
      localUri: LOCAL_SHOWCASE_MONGO_URI,
    }).toEqual({
      slug: "hoang-thien",
      production: "gym-app",
      staging: "htcoaching_staging",
      local: "htcoaching_local",
      localUri:
        "mongodb://127.0.0.1:27017/htcoaching_local?replicaSet=rs0",
    });
  });

  it("allows a read-only production dry-run to the exact loopback target", () => {
    expect(
      validateShowcaseSyncContext({
        sourceUri,
        targetUri: localUri,
        target: "local",
        apply: false,
        env: sourceEnv,
      }),
    ).toEqual({ valid: true, errors: [] });
  });

  it("requires an explicit local confirmation before apply", () => {
    const rejected = validateShowcaseSyncContext({
      sourceUri,
      targetUri: localUri,
      target: "local",
      apply: true,
      env: sourceEnv,
    });
    const accepted = validateShowcaseSyncContext({
      sourceUri,
      targetUri: localUri,
      target: "local",
      apply: true,
      env: { ...sourceEnv, CONFIRM_LOCAL_SHOWCASE_SYNC: "yes" },
    });

    expect({ rejected: rejected.errors, accepted }).toEqual({
      rejected: ["SHOWCASE_SYNC_LOCAL_CONFIRMATION_REQUIRED"],
      accepted: { valid: true, errors: [] },
    });
  });

  it("requires both staging identity and confirmation before staging apply", () => {
    const rejected = validateShowcaseSyncContext({
      sourceUri,
      targetUri: stagingUri,
      target: "staging",
      apply: true,
      env: sourceEnv,
    });
    const accepted = validateShowcaseSyncContext({
      sourceUri,
      targetUri: stagingUri,
      target: "staging",
      apply: true,
      env: {
        ...sourceEnv,
        ACCOUNT_SYNC_TARGET_ENV: "staging",
        CONFIRM_STAGING_SHOWCASE_SYNC: "yes",
      },
    });

    expect({ rejected: rejected.errors, accepted }).toEqual({
      rejected: [
        "SHOWCASE_SYNC_STAGING_ENV_REQUIRED",
        "SHOWCASE_SYNC_STAGING_CONFIRMATION_REQUIRED",
      ],
      accepted: { valid: true, errors: [] },
    });
  });

  it.each([
    [
      "a non-production source declaration",
      {
        sourceUri,
        targetUri: localUri,
        target: "local",
        env: { ACCOUNT_SYNC_SOURCE_READ_ONLY: "yes" },
      },
      "SHOWCASE_SYNC_PRODUCTION_SOURCE_REQUIRED",
    ],
    [
      "a source without a read-only declaration",
      {
        sourceUri,
        targetUri: localUri,
        target: "local",
        env: { ACCOUNT_SYNC_SOURCE_ENV: "production" },
      },
      "SHOWCASE_SYNC_READ_ONLY_SOURCE_REQUIRED",
    ],
    [
      "a source outside gym-app",
      {
        sourceUri: stagingUri,
        targetUri: localUri,
        target: "local",
        env: sourceEnv,
      },
      "SHOWCASE_SYNC_PRODUCTION_DATABASE_REQUIRED",
    ],
    [
      "a remote local target",
      {
        sourceUri,
        targetUri: "mongodb://remote.example/htcoaching_local",
        target: "local",
        env: sourceEnv,
      },
      "SHOWCASE_SYNC_LOCAL_HOST_REQUIRED",
    ],
    [
      "a local target with another database",
      {
        sourceUri,
        targetUri: "mongodb://127.0.0.1:27017/gym-app",
        target: "local",
        env: sourceEnv,
      },
      "SHOWCASE_SYNC_LOCAL_DATABASE_REQUIRED",
    ],
    [
      "a production target selector",
      {
        sourceUri,
        targetUri: sourceUri,
        target: "production",
        env: sourceEnv,
      },
      "SHOWCASE_SYNC_TARGET_INVALID",
    ],
  ])("rejects %s", (_label, options, code) => {
    expect(validateShowcaseSyncContext(options).errors).toContain(code);
  });
});
describe("showcase data sanitizers", () => {
  it("keeps only presentation fields from the published trainer", () => {
    const trainerId = new ObjectId();
    const statId = new ObjectId();
    const methodologyId = new ObjectId();
    const faqId = new ObjectId();
    const publishedAt = new Date("2026-08-01T00:00:00.000Z");
    const source = {
      _id: trainerId,
      slug: "hoang-thien",
      name: "Public trainer",
      title: "Coach",
      images: ["https://cdn.example/trainer.webp"],
      stats: [
        { _id: statId, label: "Khách hàng", value: "100+", private: true },
      ],
      methodologies: [
        {
          _id: methodologyId,
          title: "Method",
          description: "Public",
          private: true,
        },
      ],
      faqs: [
        {
          _id: faqId,
          question: "Question",
          answer: "Answer",
          private: true,
        },
      ],
      socialLinks: { facebook: "https://example.test/public" },
      status: "published",
      isHeadCoach: true,
      publishedAt,
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
      updatedAt: new Date("2026-08-02T00:00:00.000Z"),
      internalNotes: "must-not-copy",
      [["pass", "word"].join("")]: "must-not-copy",
      __v: 7,
    };

    const sanitized = sanitizeTrainer(source);

    expect(sanitized).toEqual({
      _id: trainerId,
      slug: "hoang-thien",
      name: "Public trainer",
      title: "Coach",
      images: ["https://cdn.example/trainer.webp"],
      stats: [{ _id: statId, label: "Khách hàng", value: "100+" }],
      methodologies: [
        { _id: methodologyId, title: "Method", description: "Public" },
      ],
      faqs: [{ _id: faqId, question: "Question", answer: "Answer" }],
      socialLinks: { facebook: "https://example.test/public" },
      status: "published",
      isHeadCoach: true,
      publishedAt,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
    });
  });

  it("keeps story display data but never copies its Order reference", () => {
    const storyId = new ObjectId();
    const trainerId = new ObjectId();
    const source = {
      _id: storyId,
      slug: "public-result",
      trainerId,
      orderId: new ObjectId(),
      name: "Public customer",
      result: "Public result",
      beforeImg: ["https://cdn.example/before.webp"],
      milestones: [{ title: "Public milestone", privateNote: "must-not-copy" }],
      status: "published",
      publishedAt: new Date("2026-08-03T00:00:00.000Z"),
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
      updatedAt: new Date("2026-08-04T00:00:00.000Z"),
      privateContact: "must-not-copy",
      __v: 3,
    };

    const sanitized = sanitizeCustomerStory(source);

    expect(sanitized).toEqual({
      _id: storyId,
      slug: "public-result",
      orderId: null,
      trainerId,
      name: "Public customer",
      result: "Public result",
      beforeImg: ["https://cdn.example/before.webp"],
      milestones: [{ title: "Public milestone" }],
      status: "published",
      publishedAt: source.publishedAt,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
    });
  });

  it.each([
    ["stats", { opaque: "trainer-secret" }],
    ["methodologies", "trainer-secret"],
    ["faqs", { raw: "trainer-secret" }],
    ["specialties", 42],
    ["socialLinks", ["trainer-secret"]],
    ["i18n", "trainer-secret"],
  ])("rejects a malformed trainer %s without leaking its value", (field, value) => {
    let error;
    try {
      sanitizeTrainer({ [field]: value });
    } catch (caught) {
      error = caught;
    }

    expect({
      code: error?.code,
      field: error?.field,
      leaked: error?.message.includes("trainer-secret"),
    }).toEqual({
      code: "SHOWCASE_SYNC_MALFORMED_NESTED_FIELD",
      field,
      leaked: false,
    });
  });

  it("rejects malformed trainer array entries instead of copying raw data", () => {
    expect(() =>
      sanitizeTrainer({ stats: ["trainer-secret"] }),
    ).toThrowError(
      expect.objectContaining({
        code: "SHOWCASE_SYNC_MALFORMED_NESTED_FIELD",
        field: "stats[]",
      }),
    );
  });

  it.each([
    ["milestones", { opaque: "story-secret" }],
    ["i18n", ["story-secret"]],
  ])("rejects a malformed story %s without leaking its value", (field, value) => {
    let error;
    try {
      sanitizeCustomerStory({ [field]: value });
    } catch (caught) {
      error = caught;
    }

    expect({
      code: error?.code,
      field: error?.field,
      leaked: error?.message.includes("story-secret"),
    }).toEqual({
      code: "SHOWCASE_SYNC_MALFORMED_NESTED_FIELD",
      field,
      leaked: false,
    });
  });

  it.each([
    [
      "trainer bio",
      () => sanitizeTrainer({ bio: { opaque: "leaf-secret" } }),
      "bio",
    ],
    [
      "trainer stat label",
      () =>
        sanitizeTrainer({
          stats: [{ label: { opaque: "leaf-secret" }, value: "1" }],
        }),
      "stats[].label",
    ],
    [
      "story name",
      () => sanitizeCustomerStory({ name: ["leaf-secret"] }),
      "name",
    ],
    [
      "translated trainer title",
      () =>
        sanitizeTrainer({ i18n: { en: { title: { opaque: "leaf-secret" } } } }),
      "i18n.en.title",
    ],
    [
      "trainer boolean",
      () => sanitizeTrainer({ featured: "leaf-secret" }),
      "featured",
    ],
    [
      "story number",
      () => sanitizeCustomerStory({ heroPosition: Number.POSITIVE_INFINITY }),
      "heroPosition",
    ],
    [
      "trainer date",
      () => sanitizeTrainer({ createdAt: "leaf-secret" }),
      "createdAt",
    ],
    [
      "story trainer id",
      () => sanitizeCustomerStory({ trainerId: "leaf-secret" }),
      "trainerId",
    ],
    [
      "trainer id",
      () => sanitizeTrainer({ _id: "leaf-secret" }),
      "_id",
    ],
  ])("rejects invalid %s leaf types without leaking values", (_label, action, field) => {
    let error;
    try {
      action();
    } catch (caught) {
      error = caught;
    }

    expect({
      code: error?.code,
      field: error?.field,
      leaked: error?.message.includes("leaf-secret"),
    }).toEqual({
      code: "SHOWCASE_SYNC_MALFORMED_FIELD",
      field,
      leaked: false,
    });
  });
});
