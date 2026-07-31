import { describe, expect, it } from "vitest";
import {
  buildTrainerClientWorkspacePath,
  buildTrainerHealthWorkspacePath,
  buildWellnessTargetSummary,
  getTrainerClientId,
  normalizeTrainerClientTab,
} from "../trainerClientWorkspace.helpers";

describe("trainer client workspace presentation", () => {
  it("exposes the named page export used by the lazy route adapter", async () => {
    const pageModule = await import("../TrainerClientWorkspace.jsx");

    expect(pageModule.TrainerClientWorkspace).toBeTypeOf("function");
    expect(pageModule.default).toBe(pageModule.TrainerClientWorkspace);
  });
  it("normalizes unknown tabs to overview", () => {
    expect(normalizeTrainerClientTab("unknown")).toBe("overview");
    expect(normalizeTrainerClientTab("wellness")).toBe("wellness");
  });

  it("reads client ids without coercing opaque objects", () => {
    const opaqueId = Object.create(null);

    expect(getTrainerClientId({ _id: opaqueId })).toBe("");
    expect(getTrainerClientId({ _id: { $oid: "client-123" } })).toBe(
      "client-123",
    );
    expect(getTrainerClientId({ _id: "client-456" })).toBe("client-456");
  });
  it("builds an encoded deep link with valid tab and date", () => {
    expect(
      buildTrainerClientWorkspacePath("client/123", {
        tab: "habits",
        dateKey: "2026-07-30",
      }),
    ).toBe(
      "/trainer/clients/client%2F123?tab=habits&date=2026-07-30",
    );
  });

  it("builds the canonical health-tracking deep link", () => {
    expect(
      buildTrainerHealthWorkspacePath("client/123", {
        tab: "wellness",
        dateKey: "2026-07-30",
      }),
    ).toBe(
      "/trainer/health/clients/client%2F123?tab=wellness&date=2026-07-30",
    );
    expect(
      buildTrainerHealthWorkspacePath("client-id", {
        tab: "unknown",
        dateKey: "not-a-date",
      }),
    ).toBe("/trainer/health/clients/client-id");
  });

  it("presents only complete numeric wellness targets", () => {
    expect(buildWellnessTargetSummary(null)).toEqual([]);
    expect(
      buildWellnessTargetSummary({
        targets: { sleepHours: 7.5, waterMl: 2500, steps: 8000 },
      }),
    ).toEqual([
      { key: "sleepHours", label: "Ngủ", value: "7,5 giờ" },
      { key: "waterMl", label: "Nước", value: "2,5 lít" },
      { key: "steps", label: "Số bước", value: "8.000 bước" },
    ]);
  });
});
