import { describe, expect, it } from "vitest";
import { normalizeBodyAssessmentCommand, normalizeBodyAssessmentDraft, bodyAssessmentPagination } from "../bodyAssessmentValidation.service.js";

describe("Body assessment public validation contract", () => {
  it("canonicalizes missing segments as null while preserving zero and above-100 reference", () => {
    const result = normalizeBodyAssessmentDraft({ segments: { leftArm: { leanKg: 0, fatReferencePercent: 210 } } });
    expect(result.segments.leftArm).toEqual({ leanKg: 0, leanReferencePercent: null, fatKg: null, fatReferencePercent: 210 });
    expect(result.segments.trunk).toEqual({ leanKg: null, leanReferencePercent: null, fatKg: null, fatReferencePercent: null });
    expect(result.referenceBasis).toBe("unspecified");
  });
  it("rejects nonfinite, operator keys and command unknown keys", () => {
    for (const value of [NaN, Infinity, -Infinity, "", false]) {
      expect(() => normalizeBodyAssessmentDraft({ segments: { trunk: { fatKg: value } } })).toThrow();
    }
    expect(() => normalizeBodyAssessmentDraft(JSON.parse('{"__proto__":{"isAdmin":true}}'))).toThrow();
    expect(() => normalizeBodyAssessmentCommand({ expectedRevision: 0, requestId: "command-001", draft: {}, clientId: "foreign" }, "save")).toThrow();
  });
  it("bounds query pagination and rejects unknown filters", () => {
    expect(bodyAssessmentPagination({ page: "2", limit: "100" })).toEqual({ page: 2, limit: 100 });
    for (const query of [{ page: 0 }, { limit: 101 }, { sort: "draft" }, { clientId: "foreign" }]) expect(() => bodyAssessmentPagination(query)).toThrow();
  });
});
