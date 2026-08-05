import { describe, expect, test } from "vitest";

import { MEAL_SCAN_SCENARIOS } from "../../services/mealScanAssessment.js";
import { GLOBAL_SYNTHETIC_PROXY_CASES } from "../mealScanGlobalProxyCases.js";
import { VIETNAMESE_SYNTHETIC_PROXY_CASES } from "../mealScanVietnameseProxyCases.js";

const expectValidManifest = (cases) => {
  expect(cases).toHaveLength(8);
  expect(new Set(cases.map((entry) => entry.caseId)).size).toBe(cases.length);
  expect(new Set(cases.map((entry) => entry.imageFile)).size).toBe(cases.length);

  for (const entry of cases) {
    expect(entry.caseId).toMatch(/^[a-z0-9-]+$/);
    expect(entry.imageFile).toBe(`${entry.caseId}.png`);
    expect(entry.mealAliases.length).toBeGreaterThan(0);
    expect(entry.ingredientGroups.length).toBeGreaterThan(0);
    for (const group of entry.ingredientGroups) {
      expect(group.name).toBeTruthy();
      expect(group.aliases.length).toBeGreaterThan(0);
    }
  }
};

describe("Meal Scan proxy case manifests", () => {
  test("keeps the Vietnamese recognition proxy structurally valid", () => {
    expectValidManifest(VIETNAMESE_SYNTHETIC_PROXY_CASES);
  });

  test("covers global plated, shared, dessert and drink scenarios", () => {
    expectValidManifest(GLOBAL_SYNTHETIC_PROXY_CASES);

    const scenarios = GLOBAL_SYNTHETIC_PROXY_CASES.map(
      (entry) => entry.expectedScenario,
    );
    expect(scenarios.every((scenario) => MEAL_SCAN_SCENARIOS.includes(scenario)))
      .toBe(true);
    expect(new Set(scenarios)).toEqual(
      new Set(["plated_meal", "shared_meal", "dessert", "drink"]),
    );
  });
});
