import { describe, expect, it } from "vitest";
import {
  dashboardDateFromPath,
  dashboardPathFor,
  dashboardSectionFromPath,
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
