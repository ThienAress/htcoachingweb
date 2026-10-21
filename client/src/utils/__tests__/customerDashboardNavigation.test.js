import { describe, expect, it } from "vitest";
import {
  dashboardDateFromPath,
  dashboardPathFor,
  dashboardSectionFromPath,
  isDashboardSectionVisible,
} from "../customerDashboardNavigation";

const DATE_KEY = "2026-07-29";

describe("customerDashboardNavigation", () => {
  it("builds the overview path for a concrete date", () => {
    expect(dashboardPathFor("today", DATE_KEY)).toBe(
      "/dashboard/today/2026-07-29",
    );
  });

  it("keeps the date when opening a daily module", () => {
    expect(dashboardPathFor("nutrition", DATE_KEY)).toBe(
      "/dashboard/today/2026-07-29/nutrition",
    );
  });

  it("builds progress without a date segment", () => {
    expect(dashboardPathFor("progress", DATE_KEY)).toBe(
      "/dashboard/progress",
    );
  });

  it("reads the date from a nested daily route", () => {
    expect(
      dashboardDateFromPath(
        "/dashboard/today/2026-07-29/journal",
        "2026-07-30",
      ),
    ).toBe(DATE_KEY);
  });

  it("uses the provided fallback outside a daily route", () => {
    expect(dashboardDateFromPath("/dashboard/progress", DATE_KEY)).toBe(
      DATE_KEY,
    );
  });

  it("identifies the active module", () => {
    expect(
      dashboardSectionFromPath(
        "/dashboard/today/2026-07-29/training",
      ),
    ).toBe("training");
  });
});

describe("Đánh giá bản thân trên sidebar", () => {
  it("có đường dẫn không kèm ngày và nhận ra mục đang mở", () => {
    expect(dashboardPathFor("selfAssessment", DATE_KEY)).toBe("/dashboard/self-assessment");
    expect(dashboardSectionFromPath("/dashboard/self-assessment")).toBe("selfAssessment");
  });

  it("chỉ hiện cho HT Fitness+ và người hết hạn đã từng làm đánh giá", () => {
    const visible = (accessMode, hasSelfAssessmentHistory) =>
      isDashboardSectionVisible("selfAssessment", { accessMode, hasSelfAssessmentHistory });
    expect(visible("self_managed", false)).toBe(true);
    expect(visible("coaching", false)).toBe(false);
    expect(visible("coaching", true)).toBe(false);
    expect(visible("blocked", false)).toBe(false);
    expect(visible("blocked", true)).toBe(true);
  });

  it("vẫn chỉ cho khách coaching thấy mục Tập luyện", () => {
    expect(isDashboardSectionVisible("training", { accessMode: "coaching" })).toBe(true);
    expect(isDashboardSectionVisible("training", { accessMode: "self_managed" })).toBe(false);
    expect(isDashboardSectionVisible("nutrition", { accessMode: "blocked" })).toBe(true);
  });
});
