import { describe, expect, it } from "vitest";

import {
  filterCommunityFeatures,
  filterCommunityFeaturesByGroup,
  formatPolicy,
  enforcementLabel,
  formatTrainerBenefitValue,
  formatTrainerPlanPrice,
  getCommunityFeatureDeliveryMeta,
  getCommunityFeatureAudiences,
  getCommunityFeatureGroups,
  getCommunityFeatureHistoryDateRange,
  getCommunityFeatureHistoryRecords,
  getCommunityFeatureLatestMilestone,
  getCommunityFeaturePriorityMeta,
  groupColumnPolicies,
} from "../serviceAccessPolicyPresentation.js";

describe("service access policy presentation", () => {
  it("labels the shared multi-replica quota enforcement", () => {
    expect(enforcementLabel("shared_usage_ledger")).toBe(
      "Shared usage ledger",
    );
  });

  it("formats quota and unlimited policies without hardcoded service values", () => {
    expect(
      formatPolicy({
        mode: "quota",
        limit: 3,
        unitLabel: "lượt",
        periodLabel: "24 giờ",
        scopeLabel: "user",
      }),
    ).toEqual({ primary: "3 lượt / 24 giờ", secondary: "Theo user" });

    expect(formatPolicy({ mode: "unlimited" })).toEqual({
      primary: "Không giới hạn",
      secondary: "",
    });
  });

  it("formats trainer plan headers and benefit values", () => {
    expect(
      formatTrainerPlanPrice({
        prices: { trial: 0 },
        durationDays: 30,
      }),
    ).toBe("Miễn phí · 30 ngày");
    expect(
      formatTrainerPlanPrice({
        prices: { month: 250000, year: 2500000 },
        durationDays: null,
      }),
    ).toBe("250.000 ₫/tháng · 2.500.000 ₫/năm");
    expect(formatTrainerBenefitValue(20, { valueType: "capacity" })).toBe(
      "20 học viên",
    );
    expect(formatTrainerBenefitValue(true, { valueType: "included" })).toBe(
      "Có",
    );
    expect(formatTrainerBenefitValue(false, { valueType: "included" })).toBe(
      "Không",
    );
  });

  it("groups paid tiers when their policies match and separates future drift", () => {
    const samePolicy = {
      mode: "quota",
      limit: 10,
      unitLabel: "lượt",
      periodLabel: "24 giờ",
      scopeLabel: "user",
    };
    const row = {
      policies: {
        coaching_customer: samePolicy,
        trainer: { ...samePolicy },
      },
    };
    const column = {
      tiers: [
        { key: "coaching_customer", label: "User có gói" },
        { key: "trainer", label: "HLV" },
      ],
    };

    expect(groupColumnPolicies(row, column)).toHaveLength(1);
    row.policies.trainer = { ...samePolicy, limit: 30 };
    expect(groupColumnPolicies(row, column)).toHaveLength(2);
  });

  it("derives unique community feature groups in catalog order", () => {
    const features = [
      { group: { key: "nutrition", label: "Dinh dưỡng" } },
      { group: { key: "training", label: "Tập luyện" } },
      { group: { key: "nutrition", label: "Dinh dưỡng" } },
    ];

    expect(getCommunityFeatureGroups(features)).toEqual([
      { key: "nutrition", label: "Dinh dưỡng" },
      { key: "training", label: "Tập luyện" },
    ]);
  });

  it("filters community features only by the selected group", () => {
    const features = [
      { featureKey: "tdee", group: { key: "nutrition", label: "Dinh dưỡng" } },
      { featureKey: "exercises", group: { key: "training", label: "Tập luyện" } },
      { featureKey: "meal_plan", group: { key: "nutrition", label: "Dinh dưỡng" } },
    ];

    expect(
      filterCommunityFeaturesByGroup(features, "nutrition").map(
        (feature) => feature.featureKey,
      ),
    ).toEqual(["tdee", "meal_plan"]);
  });

  it("derives stable audiences and filters by group intersection", () => {
    const features = [
      {
        featureKey: "meal_plan",
        group: { key: "nutrition", label: "Dinh dưỡng" },
        audiences: ["Cộng đồng", "Khách hàng", "HLV"],
        audienceKeys: ["community", "customer", "trainer"],
      },
      {
        featureKey: "tdee",
        group: { key: "nutrition", label: "Dinh dưỡng" },
        audiences: ["Cộng đồng"],
        audienceKeys: ["community"],
      },
      {
        featureKey: "workout_plan",
        group: { key: "training", label: "Tập luyện" },
        audiences: ["Khách hàng", "HLV"],
        audienceKeys: ["customer", "trainer"],
      },
    ];

    expect(getCommunityFeatureAudiences(features)).toEqual([
      { key: "community", label: "Cộng đồng" },
      { key: "customer", label: "Khách hàng" },
      { key: "trainer", label: "HLV" },
    ]);
    expect(
      filterCommunityFeatures(features, "nutrition", "customer").map(
        (feature) => feature.featureKey,
      ),
    ).toEqual(["meal_plan"]);
  });

  it("presents canonical feature priority and fails closed for unknown values", () => {
    expect([
      getCommunityFeaturePriorityMeta({
        code: "F0",
        label: "Cần ưu tiên ngay",
      }),
      getCommunityFeaturePriorityMeta({ code: "F9" }),
    ]).toEqual([
      { code: "F0", label: "Cần ưu tiên ngay", tone: "critical" },
      { code: "—", label: "Chưa xếp ưu tiên", tone: "unranked" },
    ]);
  });

  it("presents delivery status with a timezone-safe Vietnamese date", () => {
    expect(
      getCommunityFeatureDeliveryMeta({
        status: { code: "implemented", label: "Đã code" },
        statusDate: "2026-08-10",
      }),
    ).toEqual({
      code: "implemented",
      label: "Đã code",
      dateLabel: "10/08/2026",
      tone: "implemented",
    });
  });

  it("fails closed for unknown delivery status or an invalid date", () => {
    expect(
      getCommunityFeatureDeliveryMeta({
        status: { code: "shipped" },
        statusDate: "2026-02-31",
      }),
    ).toEqual({
      code: "unknown",
      label: "Chưa xác định",
      dateLabel: "—",
      tone: "unknown",
    });
  });

  it("selects the latest milestone from immutable improvement history", () => {
    const records = getCommunityFeatureHistoryRecords({
      improvementHistory: [
        {
          improvementKey: "conversation_continuity",
          opportunity: "Giữ phản hồi khi chuyển phiên",
          result: "Phản hồi tiếp tục chạy nền",
          milestones: [
            {
              status: { code: "implemented", label: "Đã code" },
              statusDate: "2026-08-10",
            },
            {
              status: { code: "verified", label: "Đã kiểm thử" },
              statusDate: "2026-08-11",
            },
          ],
        },
      ],
    });

    expect(getCommunityFeatureLatestMilestone(records[0])).toEqual({
      status: { code: "verified", label: "Đã kiểm thử" },
      statusDate: "2026-08-11",
    });
  });

  it("keeps a one-release fallback for legacy delivery updates", () => {
    expect(
      getCommunityFeatureHistoryRecords({
        deliveryUpdates: [
          {
            updateKey: "legacy",
            label: "Cơ hội cũ",
            result: "Kết quả cũ",
            status: { code: "implemented", label: "Đã code" },
            statusDate: "2026-08-10",
          },
        ],
      }),
    ).toEqual([
      {
        improvementKey: "legacy",
        opportunity: "Cơ hội cũ",
        result: "Kết quả cũ",
        milestones: [
          {
            status: { code: "implemented", label: "Đã code" },
            statusDate: "2026-08-10",
          },
        ],
      },
    ]);
  });

  it("derives the report date range across all milestones", () => {
    expect(
      getCommunityFeatureHistoryDateRange([
        {
          improvementHistory: [
            {
              milestones: [
                { statusDate: "2026-08-12" },
                { statusDate: "2026-08-10" },
              ],
            },
          ],
        },
        {
          deliveryUpdates: [{ statusDate: "2026-08-11" }],
        },
      ]),
    ).toEqual({ from: "2026-08-10", to: "2026-08-12" });
  });
});
