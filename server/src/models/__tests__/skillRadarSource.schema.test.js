import { describe, expect, it } from "vitest";

import SkillRadarSource from "../SkillRadarSource.js";

const validSource = () => new SkillRadarSource({
  _id: "example/repository",
  sourceType: "repository",
  name: "repository",
  sourceRepo: "example/repository",
  repoUrl: "https://github.com/example/repository",
  domain: "Testing",
  summary: "Repository test",
  localTargets: ["$qa"],
  nextCheckAt: new Date("2026-09-11T02:00:00.000Z"),
  createdBy: "507f191e810c19729de860ea",
  auditLogId: "507f191e810c19729de860eb",
});

describe("SkillRadarSource schema", () => {
  it("uses safe defaults for a newly confirmed source", () => {
    const source = validSource();

    expect(source.lifecycle).toBe("candidate");
    expect(source.drift).toBe("review_due");
    expect(source.decision).toBe("pending");
    expect(source.reviewIntervalDays).toBe(30);
  });

  it("rejects more than 12 local targets", async () => {
    const source = validSource();
    source.localTargets = Array.from({ length: 13 }, (_, index) => `target-${index}`);

    await expect(source.validate()).rejects.toMatchObject({
      errors: { localTargets: expect.anything() },
    });
  });
});
