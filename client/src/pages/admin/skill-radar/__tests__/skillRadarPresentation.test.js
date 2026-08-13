import { describe, expect, it } from "vitest";

import {
  filterSkillRadarItems,
  formatLicense,
  formatRadarDate,
  formatRadarRunDate,
  getDriftMeta,
  getRadarRateLimitRetryAt,
} from "../skillRadarPresentation.js";

const items = [
  {
    id: "mattpocock/skills/tdd",
    name: "tdd",
    sourceRepo: "mattpocock/skills",
    domain: "Testing",
    summary: "TDD workflow",
    localTargets: ["$tdd-guide", "$qa"],
    lifecycle: "active",
    drift: "changed",
  },
  {
    id: "anthropics/skills/frontend-design",
    name: "frontend-design",
    sourceRepo: "anthropics/skills",
    domain: "UI",
    summary: "Frontend taste",
    localTargets: ["$ui-quality"],
    lifecycle: "watch",
    drift: "clean",
  },
];

describe("skill radar presentation", () => {
  it("formats the expected run as an exact Vietnam date", () => {
    expect(formatRadarRunDate("2027-09-10T02:00:00.000Z")).toBe("10/09/2027");
    expect(formatRadarRunDate("invalid")).toBe("Chưa có lịch");
  });

  it("filters by search, domain and lifecycle without mutating source data", () => {
    const result = filterSkillRadarItems(items, {
      search: "matt",
      domain: "Testing",
      lifecycle: "active",
      drift: "changed",
    });

    expect(result.map((item) => item.name)).toEqual(["tdd"]);
    expect(items).toHaveLength(2);
  });

  it("maps missing dates and known drift states", () => {
    expect(formatRadarDate(null)).toBe("Chưa có");
    expect(formatLicense("NOASSERTION")).toBe("Chưa xác minh");
    expect(getDriftMeta("audit_warning")).toEqual(
      expect.objectContaining({ label: "Cảnh báo audit" }),
    );
    expect(getDriftMeta("rate_limited")).toEqual(
      expect.objectContaining({ label: "Giới hạn GitHub API" }),
    );
    expect(getDriftMeta("unexpected")).toEqual(
      expect.objectContaining({ label: "Chưa xác định" }),
    );
  });

  it("falls back to the next scheduled scan when an older rate-limit snapshot has no retry timestamp", () => {
    expect(getRadarRateLimitRetryAt({
      rateLimitRetryAt: "2026-08-12T13:00:00.000Z",
      nextCheckAt: "2026-08-13T02:00:00.000Z",
    })).toBe("2026-08-12T13:00:00.000Z");
    expect(getRadarRateLimitRetryAt({
      nextCheckAt: "2026-08-13T02:00:00.000Z",
    })).toBe("2026-08-13T02:00:00.000Z");
    expect(getRadarRateLimitRetryAt(null)).toBeNull();
  });
});
