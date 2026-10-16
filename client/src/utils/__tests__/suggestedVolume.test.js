import { describe, expect, it } from "vitest";
import { buildVolume, formatVolume } from "../suggestedVolume";

const reps = { mode: "reps", setsMin: 2, setsMax: 3, valueMin: 8, valueMax: 10, unit: "reps" };

describe("suggested volume", () => {
  it("formats ranges and collapses equal bounds", () => {
    expect(formatVolume(reps)).toBe("2–3 sets x 8–10 reps");
    expect(formatVolume({ ...reps, mode: "time", setsMin: 3, setsMax: 3, valueMin: 20, valueMax: 30 })).toBe("3 sets x 20–30 giây");
  });

  it("accepts a valid edit and rebuilds the label", () => {
    const result = buildVolume(reps, { setsMin: "3", setsMax: "4", valueMin: "10", valueMax: "12" });
    expect(result.protocol).toMatchObject({ setsMin: 3, setsMax: 4, valueMin: 10, valueMax: 12, mode: "reps" });
    expect(result.protocol.label).toBe("3–4 hiệp × 10–12 reps");
  });

  it("rejects blanks, zero, decimals and min above max", () => {
    expect(buildVolume(reps, { setsMin: "", setsMax: "3", valueMin: "8", valueMax: "10" }).error).toBeTruthy();
    expect(buildVolume(reps, { setsMin: "0", setsMax: "3", valueMin: "8", valueMax: "10" }).error).toBeTruthy();
    expect(buildVolume(reps, { setsMin: "2.5", setsMax: "3", valueMin: "8", valueMax: "10" }).error).toBeTruthy();
    expect(buildVolume(reps, { setsMin: "4", setsMax: "3", valueMin: "8", valueMax: "10" }).error).toBeTruthy();
  });
});
