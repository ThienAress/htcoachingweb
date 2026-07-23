import { describe, expect, it } from "vitest";
import { getBackgroundJobsMode } from "../backgroundJobs.js";

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
});
