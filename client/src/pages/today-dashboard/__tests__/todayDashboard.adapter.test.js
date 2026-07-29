import { describe, expect, it } from "vitest";
import { adaptTodayDashboard } from "../todayDashboard.adapter";

const contract = (overrides = {}) => ({
  contractVersion: 1,
  dateKey: "2030-01-02",
  timeZone: "Asia/Ho_Chi_Minh",
  eligibility: { status: "active", orderId: "order-1", trainer: null },
  summary: {
    dayStatus: "not_started",
    completionPercent: 0,
    formulaVersion: "today-v1",
    attentionFlags: [],
  },
  capabilities: {
    canViewSources: true,
    canEditJournal: false,
    canSubmitDay: false,
    canComment: false,
  },
  sections: {
    schedule: {
      status: "empty",
      source: "training_schedule",
      items: [],
      deepLink: "/book-training",
      error: null,
    },
    coaching: {
      status: "empty",
      source: "coaching_day",
      day: null,
      deepLink: "/online-coaching",
      error: null,
    },
    workout: {
      status: "empty",
      source: "workout_plan",
      items: [],
      deepLink: "/workout-plans",
      error: null,
    },
    attendance: {
      status: "empty",
      source: "checkin",
      items: [],
      deepLink: "/my-history",
      error: null,
    },
  },
  partialErrors: [],
  ...overrides,
});

describe("Today Dashboard contract adapter", () => {
  it("normalizes a valid v1 response", () => {
    const result = adaptTodayDashboard(contract());

    expect(result.contractVersion).toBe(1);
    expect(result.sections.schedule.items).toEqual([]);
    expect(result.sections.coaching.day).toBeNull();
  });

  it("keeps onboarding eligibility fail-closed", () => {
    const result = adaptTodayDashboard(
      contract({
        eligibility: { status: "never_coached" },
        capabilities: {
          canViewSources: false,
          canEditJournal: false,
          canSubmitDay: false,
          canComment: false,
        },
      }),
    );

    expect(result.eligibility.status).toBe("never_coached");
    expect(result.capabilities.canViewSources).toBe(false);
  });

  it("preserves redacted partial section errors", () => {
    const result = adaptTodayDashboard(
      contract({
        partialErrors: [
          { section: "workout", code: "WORKOUT_SOURCE_UNAVAILABLE" },
        ],
        sections: {
          ...contract().sections,
          workout: {
            status: "error",
            source: "workout_plan",
            items: [],
            deepLink: "/workout-plans",
            error: {
              code: "WORKOUT_SOURCE_UNAVAILABLE",
              message: "Không thể tải giáo án lúc này",
            },
          },
        },
      }),
    );

    expect(result.sections.workout.status).toBe("error");
    expect(result.partialErrors).toHaveLength(1);
  });

  it("rejects unknown versions and malformed dates", () => {
    expect(() =>
      adaptTodayDashboard(contract({ contractVersion: 2 })),
    ).toThrow("TODAY_CONTRACT_UNSUPPORTED");
    expect(() =>
      adaptTodayDashboard(contract({ dateKey: "2030-02-30" })),
    ).toThrow("TODAY_CONTRACT_INVALID");
  });
});
