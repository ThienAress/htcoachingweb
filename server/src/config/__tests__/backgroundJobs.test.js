import { describe, expect, it } from "vitest";
import {
  getBackgroundJobsMode,
  getMorningHealthReminderMode,
} from "../backgroundJobs.js";

describe("background jobs mode", () => {
  it("fails closed when configuration is missing or invalid", () => {
    expect(getBackgroundJobsMode({})).toEqual({
      enabled: false,
      explicit: false,
    });
    expect(
      getBackgroundJobsMode({ BACKGROUND_JOBS_ENABLED: "enabled" }),
    ).toEqual({
      enabled: false,
      explicit: false,
    });
  });

  it("starts jobs only for an explicit true value", () => {
    expect(getBackgroundJobsMode({ BACKGROUND_JOBS_ENABLED: "true" })).toEqual({
      enabled: true,
      explicit: true,
    });
    expect(getBackgroundJobsMode({ BACKGROUND_JOBS_ENABLED: "false" })).toEqual({
      enabled: false,
      explicit: true,
    });
  });

  it("allows the morning reminder to run independently of global jobs", () => {
    expect(
      getMorningHealthReminderMode({
        BACKGROUND_JOBS_ENABLED: "false",
        MORNING_HEALTH_REMINDER_ENABLED: "true",
        TODAY_DASHBOARD_ENABLED: "true",
        TODAY_JOURNAL_WRITES_ENABLED: "true",
      }),
    ).toEqual({ enabled: true, explicit: true });
  });

  it("keeps the morning reminder fail-closed without all prerequisites", () => {
    expect(getMorningHealthReminderMode({})).toEqual({
      enabled: false,
      explicit: false,
    });
    expect(
      getMorningHealthReminderMode({
        MORNING_HEALTH_REMINDER_ENABLED: "true",
        TODAY_DASHBOARD_ENABLED: "true",
        TODAY_JOURNAL_WRITES_ENABLED: "false",
      }),
    ).toEqual({ enabled: false, explicit: true });
  });
});
