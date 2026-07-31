import { describe, expect, it } from "vitest";
import {
  getTodayPlatformMode,
  TODAY_PLATFORM_API_PREFIXES,
} from "../todayPlatform.js";

describe("Today platform server feature flag", () => {
  it("fails closed in production unless explicitly enabled", () => {
    expect(getTodayPlatformMode({ NODE_ENV: "production" })).toEqual({
      enabled: false,
      explicit: false,
      productionApproval: false,
    });
    expect(
      getTodayPlatformMode({
        NODE_ENV: "production",
        TODAY_DASHBOARD_ENABLED: "invalid",
      }),
    ).toEqual({
      enabled: false,
      explicit: false,
      productionApproval: false,
    });
  });

  it("preserves staging and test defaults while honoring explicit false", () => {
    expect(
      getTodayPlatformMode({ NODE_ENV: "production", APP_ENV: "staging" }),
    ).toEqual({
      enabled: true,
      explicit: false,
      productionApproval: false,
    });
    expect(getTodayPlatformMode({ NODE_ENV: "test" })).toEqual({
      enabled: true,
      explicit: false,
      productionApproval: false,
    });
    expect(
      getTodayPlatformMode({
        NODE_ENV: "test",
        TODAY_DASHBOARD_ENABLED: "false",
      }),
    ).toEqual({
      enabled: false,
      explicit: true,
      productionApproval: false,
    });
  });

  it("requires two explicit keys before production can be enabled", () => {
    expect(
      getTodayPlatformMode({
        NODE_ENV: "production",
        APP_ENV: "production",
        TODAY_DASHBOARD_ENABLED: "true",
      }),
    ).toEqual({
      enabled: false,
      explicit: true,
      productionApproval: false,
    });
    expect(
      getTodayPlatformMode({
        NODE_ENV: "production",
        APP_ENV: "production",
        TODAY_DASHBOARD_ENABLED: "true",
        TODAY_PLATFORM_PRODUCTION_APPROVED: "true",
      }),
    ).toEqual({
      enabled: true,
      explicit: true,
      productionApproval: true,
    });
  });

  it("covers every new Today API family with the global gate", () => {
    expect(TODAY_PLATFORM_API_PREFIXES).toEqual(
      expect.arrayContaining([
        "/api/today-dashboard",
        "/api/daily-journals",
        "/api/wellness-targets",
        "/api/saved-meal-plans",
        "/api/coaching-habits",
        "/api/weekly-checkins",
        "/api/progress",
        "/api/coaching-comments",
        "/api/trainer-overview",
        "/api/notifications",
        "/api/trainer-client-overview",
        "/api/coaching-activity",
      ]),
    );
  });
});
