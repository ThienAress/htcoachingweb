import crypto from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  ACCOUNT_SYNC_EMAIL_DIGEST,
  LOCAL_ACCOUNT_DATABASE,
  PRODUCTION_ACCOUNT_DATABASE,
  STAGING_ACCOUNT_DATABASE,
  buildAccountGraph,
  fingerprintDocument,
  resolveAccountSyncEmail,
  sanitizeAccountUser,
  validateSyncContext,
} from "../singleAccountSync.contract.js";

const sourceUri =
  "mongodb+srv://readonly.example/gym-app?retryWrites=false";
const stagingUri =
  "mongodb+srv://staging.example/htcoaching_staging?retryWrites=true";
const localUri = "mongodb://127.0.0.1:27017/htcoaching_local";
const accountEmail = "owner.account@example.test";
const accountEmailDigest = crypto
  .createHash("sha256")
  .update(accountEmail)
  .digest("hex");

describe("single-account sync identity and environment guards", () => {
  it("pins the only permitted account and databases", () => {
    expect(ACCOUNT_SYNC_EMAIL_DIGEST).toMatch(/^[a-f0-9]{64}$/);
    expect(PRODUCTION_ACCOUNT_DATABASE).toBe("gym-app");
    expect(STAGING_ACCOUNT_DATABASE).toBe("htcoaching_staging");
    expect(LOCAL_ACCOUNT_DATABASE).toBe("htcoaching_local");
  });

  it("accepts a declared read-only production source and exact staging target", () => {
    expect(
      validateSyncContext({
        sourceUri,
        targetUri: stagingUri,
        target: "staging",
        accountEmailDigest,
        env: {
          ACCOUNT_SYNC_EMAIL: accountEmail,
          ACCOUNT_SYNC_SOURCE_ENV: "production",
          ACCOUNT_SYNC_SOURCE_READ_ONLY: "yes",
          ACCOUNT_SYNC_TARGET_ENV: "staging",
          CONFIRM_STAGING_ACCOUNT_SYNC: "yes",
        },
      }),
    ).toEqual({ valid: true, errors: [] });
  });

  it("accepts only loopback for the exact local target", () => {
    expect(
      validateSyncContext({
        sourceUri,
        targetUri: localUri,
        target: "local",
        accountEmailDigest,
        env: {
          ACCOUNT_SYNC_EMAIL: accountEmail,
          ACCOUNT_SYNC_SOURCE_ENV: "production",
          ACCOUNT_SYNC_SOURCE_READ_ONLY: "yes",
          CONFIRM_LOCAL_ACCOUNT_SYNC: "yes",
        },
      }),
    ).toEqual({ valid: true, errors: [] });

    const result = validateSyncContext({
      sourceUri,
      targetUri: "mongodb://remote.example/htcoaching_local",
      target: "local",
      accountEmailDigest,
      env: {
        ACCOUNT_SYNC_EMAIL: accountEmail,
        ACCOUNT_SYNC_SOURCE_ENV: "production",
        ACCOUNT_SYNC_SOURCE_READ_ONLY: "yes",
        CONFIRM_LOCAL_ACCOUNT_SYNC: "yes",
      },
    });
    expect(result.errors).toContain("ACCOUNT_SYNC_LOCAL_HOST_REQUIRED");
  });

  it.each([
    [
      "source is not production",
      { ACCOUNT_SYNC_SOURCE_ENV: "staging", ACCOUNT_SYNC_SOURCE_READ_ONLY: "yes" },
      "ACCOUNT_SYNC_PRODUCTION_SOURCE_REQUIRED",
    ],
    [
      "source credential is not declared read-only",
      { ACCOUNT_SYNC_SOURCE_ENV: "production" },
      "ACCOUNT_SYNC_READ_ONLY_SOURCE_REQUIRED",
    ],
  ])("rejects when %s", (_label, env, code) => {
    expect(
      validateSyncContext({
        sourceUri,
        targetUri: stagingUri,
        target: "staging",
        accountEmailDigest,
        env: {
          ACCOUNT_SYNC_EMAIL: accountEmail,
          ...env,
          ACCOUNT_SYNC_TARGET_ENV: "staging",
          CONFIRM_STAGING_ACCOUNT_SYNC: "yes",
        },
      }).errors,
    ).toContain(code);
  });

  it("rejects a production target or a source URI pointed at a lower environment", () => {
    expect(
      validateSyncContext({
        sourceUri,
        targetUri: sourceUri,
        target: "production",
        accountEmailDigest,
        env: { ACCOUNT_SYNC_EMAIL: accountEmail },
      }).errors,
    ).toContain("ACCOUNT_SYNC_TARGET_INVALID");
    expect(
      validateSyncContext({
        sourceUri: stagingUri,
        targetUri: localUri,
        target: "local",
        accountEmailDigest,
        env: {
          ACCOUNT_SYNC_EMAIL: accountEmail,
          ACCOUNT_SYNC_SOURCE_ENV: "production",
          ACCOUNT_SYNC_SOURCE_READ_ONLY: "yes",
          CONFIRM_LOCAL_ACCOUNT_SYNC: "yes",
        },
      }).errors,
    ).toContain("ACCOUNT_SYNC_PRODUCTION_DATABASE_REQUIRED");
  });

  it("rejects any runtime identity other than the pinned account", () => {
    expect(() =>
      resolveAccountSyncEmail("different@example.test", {
        expectedDigest: accountEmailDigest,
      }),
    ).toThrowError(expect.objectContaining({ code: "ACCOUNT_SYNC_EXACT_EMAIL_REQUIRED" }));
  });
});

describe("single-account sync sanitizer", () => {
  it("copies only schema-backed profile and business fields", () => {
    expect(
      sanitizeAccountUser({
        _id: "user-1",
        email: accountEmail,
        name: "Test User",
        role: "user",
        password: "hash",
        passwordHash: "legacy-hash",
        refreshToken: "refresh",
        resetPasswordToken: "reset",
        resetPasswordExpires: new Date("2026-08-22T00:00:00.000Z"),
        googleId: "provider-id",
        oauth: { accessToken: "oauth-token" },
        futureProviderSecret: "must-not-copy",
        mealPlanGenerations: 2,
      }),
    ).toEqual({
      _id: "user-1",
      email: accountEmail,
      name: "Test User",
      role: "user",
      mealPlanGenerations: 2,
    });
  });
});

describe("single-account graph selection", () => {
  const userId = "507f191e810c19729de860ea";
  const otherUserId = "507f191e810c19729de860eb";

  it("keeps only the exact account graph and follows check-ins through owned orders", () => {
    const graph = buildAccountGraph({
      accountUser: { _id: userId, email: accountEmail, name: "Test" },
      accountEmail,
      accountEmailDigest,
      collections: {
        users: [
          { _id: userId, email: accountEmail, name: "Test" },
          { _id: otherUserId, email: "other@example.com", name: "Other" },
        ],
        orders: [
          { _id: "order-1", userId, status: "approved" },
          { _id: "order-2", userId: otherUserId, status: "approved" },
        ],
        checkins: [
          { _id: "checkin-1", orderId: "order-1" },
          { _id: "checkin-2", orderId: "order-2" },
        ],
        dailyjournals: [
          { _id: "journal-1", clientId: userId },
          { _id: "journal-2", clientId: otherUserId },
        ],
        wallettransactions: [{ _id: "financial-1", userId }],
      },
    });

    expect(graph.users).toHaveLength(1);
    expect(graph.orders.map((row) => row._id)).toEqual(["order-1"]);
    expect(graph.checkins.map((row) => row._id)).toEqual(["checkin-1"]);
    expect(graph.dailyjournals.map((row) => row._id)).toEqual(["journal-1"]);
    expect(graph).not.toHaveProperty("wallettransactions");
  });

  it("fingerprints sanitized BSON-shaped data deterministically", () => {
    expect(fingerprintDocument({ b: 2, a: 1 })).toBe(
      fingerprintDocument({ a: 1, b: 2 }),
    );
    expect(fingerprintDocument({ a: 1 })).not.toBe(
      fingerprintDocument({ a: 2 }),
    );
  });
});
