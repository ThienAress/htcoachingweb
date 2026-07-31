import { describe, expect, it } from "vitest";
import { getSectionProgressPresentation } from "../todayDashboardProgress";

const summary = {
  moduleProgress: {
    training: {
      completed: 0,
      total: 0,
      percent: null,
      state: "not_applicable",
    },
    nutrition: {
      completed: 0,
      total: 0,
      percent: null,
      state: "not_applicable",
    },
    journal: {
      completed: 3,
      total: 10,
      percent: 30,
      state: "in_progress",
    },
  },
};

describe("Today Dashboard section progress presentation", () => {
  it("labels a training day without assignments explicitly", () => {
    expect(getSectionProgressPresentation(summary, "training")).toMatchObject({
      hasTasks: false,
      valueLabel: "Không có nhiệm vụ",
    });
  });

  it("labels nutrition without an assigned plan explicitly", () => {
    expect(getSectionProgressPresentation(summary, "nutrition")).toMatchObject({
      hasTasks: false,
      valueLabel: "Chưa có thực đơn áp dụng",
    });
  });

  it("uses the journal module percentage instead of the global percentage", () => {
    expect(getSectionProgressPresentation(summary, "journal")).toMatchObject({
      hasTasks: true,
      percent: 30,
      valueLabel: "30%",
    });
  });

  it("does not expose progress on the overview route", () => {
    expect(getSectionProgressPresentation(summary, "today")).toBeNull();
  });
});
