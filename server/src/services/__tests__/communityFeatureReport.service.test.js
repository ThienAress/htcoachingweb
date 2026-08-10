import { describe, expect, it } from "vitest";

import { buildCommunityFeatureReport } from "../communityFeatureReport.service.js";

const NOW = new Date("2026-08-10T03:30:00.000Z");
const captureError = (callback) => {
  try {
    callback();
  } catch (error) {
    return error;
  }
  throw new Error("Expected callback to throw");
};

describe("community feature report service", () => {
  it("builds canonical summary from every history milestone", () => {
    const report = buildCommunityFeatureReport({}, { now: NOW });

    expect(report.summary).toEqual({
      eventCount: 5,
      improvementCount: 5,
      featureCount: 2,
      productionVerifiedCount: 0,
      openF0Count: 2,
      latestDate: "2026-08-10",
      statusCounts: {
        in_progress: 0,
        implemented: 5,
        verified: 0,
        production_verified: 0,
      },
    });
  });

  it("preserves the six historical snapshot fields on report rows", () => {
    const report = buildCommunityFeatureReport({}, { now: NOW });

    expect(report.rows[0]).toEqual(
      expect.objectContaining({
        statusDate: "2026-08-10",
        snapshotVersion: "2026-08-10.2",
        featureLabel: "HT Assistant",
        group: { key: "ai_support", label: "AI hỗ trợ" },
        priority: { code: "F0", rank: 0, label: "Cần ưu tiên ngay" },
        primaryValue:
          "Trả lời và định hướng người dùng về tập luyện, dinh dưỡng, phục hồi và các dịch vụ HTCOACHING.",
        audiences: ["Cộng đồng", "Khách hàng", "HLV"],
      }),
    );
  });

  it("groups updated features and improvements into a daily timeline", () => {
    const report = buildCommunityFeatureReport({}, { now: NOW });

    expect(
      report.timeline.map((day) => ({
        date: day.date,
        features: day.features.map((feature) => [
          feature.featureKey,
          feature.improvementCount,
        ]),
      })),
    ).toEqual([
      {
        date: "2026-08-10",
        features: [
          ["ht_assistant", 3],
          ["meal_plan", 2],
        ],
      },
    ]);
  });

  it("filters inclusively by group, status and date", () => {
    const report = buildCommunityFeatureReport(
      {
        from: "2026-08-10",
        to: "2026-08-10",
        group: "nutrition",
        status: "implemented",
      },
      { now: NOW },
    );

    expect(report.summary.eventCount).toBe(2);
  });

  it("keeps the historical group label when the current catalog group changed", () => {
    const report = buildCommunityFeatureReport(
      { group: "legacy_group" },
      {
        now: NOW,
        catalogVersion: "2026-08-11",
        catalog: [
          {
            featureKey: "example_feature",
            group: { key: "current_group", label: "Nhóm hiện tại" },
            priority: { code: "F1", rank: 1, label: "Ưu tiên kế tiếp" },
            currentImprovement: null,
            improvementHistory: [
              {
                improvementKey: "legacy_improvement",
                opportunity: "Cơ hội lịch sử",
                result: "Kết quả lịch sử",
                snapshot: {
                  catalogVersion: "2026-08-10",
                  featureLabel: "Tính năng lịch sử",
                  group: { key: "legacy_group", label: "Nhóm lịch sử" },
                  priority: {
                    code: "F0",
                    rank: 0,
                    label: "Cần ưu tiên ngay",
                  },
                  primaryValue: "Giá trị lịch sử",
                  audiences: ["Cộng đồng"],
                },
                milestones: [
                  {
                    status: {
                      code: "implemented",
                      rank: 1,
                      label: "Đã code",
                    },
                    statusDate: "2026-08-10",
                  },
                ],
              },
            ],
          },
        ],
      },
    );

    expect(report.filterLabels.group).toBe("Nhóm lịch sử");
  });

  it("rejects an invalid date range", () => {
    const error = captureError(() =>
      buildCommunityFeatureReport(
        { from: "2026-08-11", to: "2026-08-10" },
        { now: NOW },
      ),
    );

    expect({ code: error.code, statusCode: error.statusCode }).toEqual({
      code: "COMMUNITY_FEATURE_REPORT_DATE_RANGE_INVALID",
      statusCode: 400,
    });
  });

  it("rejects an unknown group filter", () => {
    const error = captureError(() =>
      buildCommunityFeatureReport(
        { group: "unknown" },
        { now: NOW },
      ),
    );

    expect({ code: error.code, statusCode: error.statusCode }).toEqual({
      code: "COMMUNITY_FEATURE_REPORT_GROUP_INVALID",
      statusCode: 400,
    });
  });

  it("rejects an unknown status filter", () => {
    const error = captureError(() =>
      buildCommunityFeatureReport({ status: "shipped" }, { now: NOW }),
    );

    expect({ code: error.code, statusCode: error.statusCode }).toEqual({
      code: "COMMUNITY_FEATURE_REPORT_STATUS_INVALID",
      statusCode: 400,
    });
  });
});
