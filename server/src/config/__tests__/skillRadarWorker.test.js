import { describe, expect, it } from "vitest";

import { getSkillRadarWorkerMode } from "../skillRadarWorker.js";

describe("Skill Radar worker mode", () => {
  it("fails closed when the dedicated worker flag is missing", () => {
    expect(getSkillRadarWorkerMode({})).toEqual({
      enabled: false,
      explicit: false,
      reason: "worker_flag_required",
    });
  });

  it("requires global background jobs to be explicitly disabled", () => {
    expect(
      getSkillRadarWorkerMode({
        SKILL_RADAR_WORKER_ENABLED: "true",
        BACKGROUND_JOBS_ENABLED: "true",
        SKILL_RADAR_GITHUB_TOKEN: "read-only-token",
      }),
    ).toEqual({
      enabled: false,
      explicit: true,
      reason: "global_jobs_must_be_disabled",
    });
  });

  it("requires the dedicated GitHub token before starting", () => {
    expect(
      getSkillRadarWorkerMode({
        SKILL_RADAR_WORKER_ENABLED: "true",
        BACKGROUND_JOBS_ENABLED: "false",
      }),
    ).toEqual({
      enabled: false,
      explicit: true,
      reason: "github_token_missing",
    });
  });

  it("enables only the isolated worker contract", () => {
    expect(
      getSkillRadarWorkerMode({
        SKILL_RADAR_WORKER_ENABLED: "true",
        BACKGROUND_JOBS_ENABLED: "false",
        SKILL_RADAR_GITHUB_TOKEN: "read-only-token",
      }),
    ).toEqual({
      enabled: true,
      explicit: true,
      reason: null,
    });
  });
});
