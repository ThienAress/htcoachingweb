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
      ["Giai đoạn 2: Hypertrophy", true],
      ["Giai đoạn 3", true],
    ]);
  });

  it("opens one stage per saved review and keeps one locked stage after it", () => {
    const tabs = buildStageTabs(
      [stage(1, "phase_1", "Stabilization Endurance"), stage(2, "phase_2", "Strength Endurance")],
      [
        { stageOrder: 1, profileConfirmed: true, nextPhasePlan: { phaseTitle: "Strength Endurance" } },
        { stageOrder: 2, profileConfirmed: true, nextPhasePlan: { phaseKey: "phase_3", phaseTitle: "Hypertrophy" } },
      ],
    );

    expect(tabs.map((tab) => [tab.label, tab.locked])).toEqual([
      ["Giai đoạn 1: Stabilization Endurance", false],
      ["Giai đoạn 2: Strength Endurance", false],
      ["Giai đoạn 3: Hypertrophy", false],
      ["Giai đoạn 4: Hypertrophy", true],
    ]);
  });

  it("keeps a stage locked until its goal step is confirmed", () => {
    const tabs = buildStageTabs(
      [stage(1, "phase_2", "Strength Endurance")],
      [{ stageOrder: 1, profileConfirmed: false, nextPhasePlan: { phaseKey: "phase_3", phaseTitle: "Hypertrophy" } }],
    );

    expect(tabs.map((tab) => [tab.label, tab.locked])).toEqual([
      ["Giai đoạn 1: Strength Endurance", false],
      ["Giai đoạn 2: Hypertrophy", true],
      ["Giai đoạn 3", true],
    ]);
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
