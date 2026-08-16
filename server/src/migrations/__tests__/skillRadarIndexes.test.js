import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { setupTestDB, teardownTestDB } from "../../__tests__/setup.js";
import SkillRadarSource from "../../models/SkillRadarSource.js";
import {
  applySkillRadarIndexes,
  getSkillRadarIndexContract,
  inspectSkillRadarIndexes,
} from "../20260813-skill-radar-indexes.js";

describe("Skill Radar index migration", () => {
  beforeAll(async () => {
    await setupTestDB();
    await SkillRadarSource.createCollection().catch((error) => {
      if (error?.codeName !== "NamespaceExists") throw error;
    });
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  test("derives the scheduler index from the model schema", () => {
    expect(getSkillRadarIndexContract()).toMatchObject({
      name: "skill_radar_refresh_due",
      keys: { lifecycle: 1, nextCheckAt: 1 },
    });
  });

  test("creates the missing index and remains idempotent", async () => {
    await SkillRadarSource.collection.dropIndexes();
    const firstInspection = await inspectSkillRadarIndexes();
    const created = await applySkillRadarIndexes(firstInspection);
    const secondInspection = await inspectSkillRadarIndexes();
    const rerun = await applySkillRadarIndexes(secondInspection);

    expect({
      firstStatus: firstInspection[0].status,
      created: created[0].status,
      secondStatus: secondInspection[0].status,
      rerun: rerun[0].status,
    }).toEqual({
      firstStatus: "missing",
      created: "created",
      secondStatus: "present",
      rerun: "unchanged",
    });
  });

  test("refuses a conflicting index name", async () => {
    const contract = getSkillRadarIndexContract();
    await expect(
      applySkillRadarIndexes([{ contract, status: "name_conflict" }]),
    ).rejects.toThrow("blocked by preflight findings");
  });
});
