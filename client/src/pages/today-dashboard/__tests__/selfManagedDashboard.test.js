import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("HT Fitness+ self-managed presentation contract", () => {
  it("removes trainer-only surfaces while preserving self-save modules", () => {
    const layout = read("../../../layouts/CustomerDashboardLayout.jsx");
    const dashboard = read("../TodayDashboard.jsx");
    const nutrition = read("../NutritionCard.jsx");
    const journal = read("../TodayJournal.jsx");
    const wellness = read("../WellnessCard.jsx");
    const wellnessHeader = read("../WellnessHeader.jsx");
    const weekly = read("../../progress/WeeklyCheckinCard.jsx");
    const dayLayout = read("../TodayDashboardDayLayout.jsx");

    expect(layout).toContain('accessMode === "coaching" || item.key !== "training"');
    expect(dashboard).toContain('data.accessMode !== "self_managed" || key !== "training"');
    expect(nutrition).toContain("!selfManaged && <div");
    expect(nutrition).toContain(
      "const nutritionLocked = !selfManaged && nutritionSubmitted;",
    );
    expect(nutrition).toContain(
      "!canEdit || nutritionLocked || command.isPending",
    );
    expect(journal).toContain("!selfManaged && <ActivityTimeline");
    expect(wellness).toContain("!selfManaged && (");
    expect(wellnessHeader).toContain("cập nhật Tiến trình của bạn");
    expect(weekly).toContain("!selfManaged && query.data?._id");
    expect(weekly).toContain('selfManaged ? "Đã lưu số đo tuần"');
    expect(weekly).toContain('mutation.isPending ? "Đang lưu..." : "Lưu"');
    expect(dashboard).toContain(
      'selfManaged\n                    ? "Bạn có thể tự cập nhật sức khỏe, bữa ăn và thói quen hôm nay."',
    );
    expect(journal).toContain('selfManaged ? "Nhật ký hằng ngày"');
    expect(journal).toContain('selfManaged ? "Số đo hằng tuần"');
    expect(dayLayout).toContain(
      'selfManaged && section === "journal"',
    );
    expect(dayLayout).toContain(
      'query.data?.accessMode === "coaching"\n                ? "Dashboard học viên"\n                : "Dashboard của tôi"',
    );
  });
});
