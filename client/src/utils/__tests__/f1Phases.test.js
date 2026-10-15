import { describe, expect, it } from "vitest";
import {
  MIN_VISIBLE_STAGES,
  PHASE_EXPLANATIONS,
  PHASE_NAMES,
  buildStageTabs,
} from "../../constants/f1Phases";

const stage = (stageOrder, phaseKey, phaseTitle) => ({
  stageOrder,
  phaseKey,
  phaseTitle,
});

describe("buildStageTabs", () => {
  it("adds locked tabs after a single-stage roadmap", () => {
    const tabs = buildStageTabs([stage(1, "phase_2", "Strength Endurance")]);

    expect(tabs).toHaveLength(MIN_VISIBLE_STAGES);
    expect(tabs[0]).toEqual({
      key: "phase_2",
      stageOrder: 1,
      label: "Giai đoạn 1: Strength Endurance",
      locked: false,
    });
    expect(tabs.slice(1).map((tab) => [tab.label, tab.locked])).toEqual([
      ["Giai đoạn 2", true],
      ["Giai đoạn 3", true],
    ]);
  });

  it("keeps every roadmap stage and only fills the remaining slots", () => {
    const tabs = buildStageTabs([
      stage(1, "phase_1", "Stabilization Endurance"),
      stage(2, "phase_2", "Strength Endurance"),
      stage(3, "phase_3", "Hypertrophy"),
    ]);

    expect(tabs.every((tab) => !tab.locked)).toBe(true);
  });

  it("shows locked tabs when there is no roadmap yet", () => {
    expect(buildStageTabs().map((tab) => tab.key)).toEqual([
      "locked_1",
      "locked_2",
      "locked_3",
    ]);
  });
});

describe("phase copy", () => {
  it("names phases without a NASM phase number", () => {
    for (const key of Object.keys(PHASE_NAMES)) {
      expect(PHASE_NAMES[key]).not.toMatch(/Giai đoạn \d/);
      expect(PHASE_EXPLANATIONS[key]).toBeTruthy();
    }
  });
});
