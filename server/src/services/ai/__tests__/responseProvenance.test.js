import { describe, expect, it } from "vitest";
import { resolveResponseProvenance } from "../responseProvenance.js";

describe("answer provenance", () => {
  it.each([
    [{ webSearchRequired: true, webEvidenceAvailable: true }, "web_grounded"],
    [{ webSearchRequired: true, model: "deepseek-v4.1-flash" }, "capability_unavailable"],
    [{ model: "server_workout_draft_v1" }, "deterministic_server"],
    [{ model: "deepseek-v4.1-flash", internalSourceCount: 2 }, "internal_kb"],
    [{ model: "deepseek-v4.1-flash" }, "model_prior"],
  ])("identifies delivered evidence for %j", (context, expected) => {
    expect(resolveResponseProvenance(context)).toBe(expected);
  });

  it("does not label a missing required web answer as grounded using an internal source", () => {
    expect(resolveResponseProvenance({ webSearchRequired: true, internalSourceCount: 1,
      model: "server:web_evidence_unavailable" })).toBe("capability_unavailable");
  });
});
