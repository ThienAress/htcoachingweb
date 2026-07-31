import { afterEach, describe, expect, it } from "vitest";
import { syncDailyJournalRetentionForClient } from "../dailyJournalRetentionPolicy.service.js";

const originalNodeEnv = process.env.NODE_ENV;
const originalAppEnv = process.env.APP_ENV;
const originalTodayFlag = process.env.TODAY_DASHBOARD_ENABLED;
const originalProductionApproval =
  process.env.TODAY_PLATFORM_PRODUCTION_APPROVED;

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalAppEnv === undefined) delete process.env.APP_ENV;
  else process.env.APP_ENV = originalAppEnv;
  if (originalTodayFlag === undefined) {
    delete process.env.TODAY_DASHBOARD_ENABLED;
  } else {
    process.env.TODAY_DASHBOARD_ENABLED = originalTodayFlag;
  }
  if (originalProductionApproval === undefined) {
    delete process.env.TODAY_PLATFORM_PRODUCTION_APPROVED;
  } else {
    process.env.TODAY_PLATFORM_PRODUCTION_APPROVED =
      originalProductionApproval;
  }
});

describe("daily journal retention platform guard", () => {
  it("returns before database access when production is disabled", async () => {
    process.env.NODE_ENV = "production";
    process.env.APP_ENV = "production";
    delete process.env.TODAY_DASHBOARD_ENABLED;
    delete process.env.TODAY_PLATFORM_PRODUCTION_APPROVED;

    await expect(
      syncDailyJournalRetentionForClient({ clientId: "not-an-object-id" }),
    ).resolves.toEqual({ updated: 0, state: "feature_disabled" });
  });
});
