import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ProgressSummary } from "../ProgressSummary";

const progress = {
  range: { startDateKey: "2026-08-01", endDateKey: "2026-08-23" },
  compliance: {
    scheduleAttendance: { numerator: 1, denominator: 2, percent: 50 },
  },
  bodyProgress: {
    weightKg: { unit: "kg", current: null, delta: null, series: [] },
    waistCm: { unit: "cm", current: null, delta: null, series: [] },
  },
  wellness: { daily: [] },
};

const renderSummary = (activeSection = null) =>
  renderToStaticMarkup(
    <ProgressSummary
      progress={progress}
      selectedDateKey="2026-08-23"
      activeSection={activeSection}
      onSectionChange={vi.fn()}
      landingActions={<div>Cập nhật dữ liệu</div>}
      rangeControls={<div>Chọn khoảng thời gian</div>}
    />,
  );

describe("ProgressSummary", () => {
  it("renders one combined progress landing with the three entry actions", () => {
    const html = renderSummary();

    expect(html).toContain("Tiến trình cơ thể và huấn luyện");
    expect(html).toContain(
      "Tổng hợp từ lịch tập, giáo án và những nhật ký hoặc báo cáo tuần bạn đã gửi",
    );
    expect(html).toContain("Mức độ thực hiện");
    expect(html).toContain("Tiến trình cơ thể");
    expect(html).toContain("Sức khỏe trung bình");
    expect((html.match(/Cập nhật dữ liệu/g) || [])).toHaveLength(1);
    expect(html).not.toContain("Chọn nội dung muốn xem");
    expect(html).not.toContain("Chọn khoảng thời gian");
    expect(html).not.toContain('role="progressbar"');
  });

  it("mounts only the selected progress content and its range controls", () => {
    const html = renderSummary("compliance");

    expect((html.match(/Tiến trình cơ thể và huấn luyện/g) || [])).toHaveLength(1);
    expect((html.match(/Cập nhật dữ liệu/g) || [])).toHaveLength(1);
    expect(html).toContain("Chọn khoảng thời gian");
    expect(html).toContain("Lịch tập với HLV");
    expect(html).toContain('data-progress-section-card="compliance"');
    expect(html).toContain('data-compliance-chart="true"');
    expect(html).not.toContain("Chưa có số đo cân nặng");
    expect(html).not.toContain("Sức khỏe ngày 23/08/2026");
  });

  it("renders body range controls inside a single body chart surface", () => {
    const bodyProgress = {
      ...progress,
      bodyProgress: {
        weightKg: {
          unit: "kg",
          current: { dateKey: "2026-08-17", value: 76.5 },
          delta: -1,
          series: [
            { dateKey: "2026-08-10", value: 77.5 },
            { dateKey: "2026-08-17", value: 76.5 },
          ],
        },
        waistCm: { unit: "cm", current: null, delta: null, series: [] },
        bodyFatPercent: { unit: "%", current: null, delta: null, series: [] },
        skeletalMusclePercent: {
          unit: "%",
          current: null,
          delta: null,
          series: [],
        },
      },
    };
    const html = renderToStaticMarkup(
      <ProgressSummary
        progress={bodyProgress}
        selectedDateKey="2026-08-23"
        activeSection="body"
        onSectionChange={vi.fn()}
        rangeControls={<div>Chọn khoảng thời gian</div>}
      />,
    );

    expect(html).toContain("Chọn khoảng thời gian");
    expect((html.match(/data-body-metric-chart="true"/g) || [])).toHaveLength(1);
    expect(html).toContain('data-progress-section-card="body"');
  });

  it("renders one wellness card with one active daily trend chart", () => {
    const wellnessProgress = {
      ...progress,
      wellness: {
        sleepHours: { average: 7, count: 2 },
        waterMl: { average: 2100, count: 2 },
        steps: { average: 8500, count: 2 },
        energy: { average: 6, count: 2 },
        hunger: { average: 5, count: 2 },
        stress: { average: 4, count: 2 },
        soreness: { average: 3, count: 2 },
        pain: { average: 1, count: 2 },
        daily: [
          { dateKey: "2026-08-21", sleepHours: 6.5, energy: 5 },
          { dateKey: "2026-08-23", sleepHours: 7.5, energy: 7 },
        ],
      },
    };
    const html = renderToStaticMarkup(
      <ProgressSummary
        progress={wellnessProgress}
        selectedDateKey="2026-08-23"
        activeSection="wellness"
        onSectionChange={vi.fn()}
        landingActions={<div>Cập nhật dữ liệu</div>}
        rangeControls={<div>Chọn khoảng thời gian</div>}
      />,
    );

    expect(html).toContain('data-progress-section-card="wellness"');
    expect((html.match(/data-wellness-metric-chart="true"/g) || [])).toHaveLength(1);
    expect((html.match(/role="tab"/g) || [])).toHaveLength(8);
    expect((html.match(/Sức khỏe trung bình/g) || [])).toHaveLength(1);
    expect(html).not.toContain("Sức khỏe ngày");
    expect(html).not.toContain(">Hôm nay<");
  });
});
