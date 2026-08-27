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

    expect(html).toContain("Tiến trình cơ thể và tập luyện");
    expect(html).not.toContain(
      "Tổng hợp từ lịch tập, giáo án và những nhật ký hoặc báo cáo tuần bạn đã gửi",
    );
    expect(html).toContain("Mức độ thực hiện");
    expect(html).toContain("Tiến trình cơ thể");
    expect(html).toContain("Sức khỏe trung bình");
    expect((html.match(/Cập nhật dữ liệu/g) || [])).toHaveLength(1);
    expect((html.match(/data-progress-navigation-card="true"/g) || [])).toHaveLength(1);
    expect(html).not.toContain("Chọn nội dung muốn xem");
    expect(html).not.toContain("Chọn khoảng thời gian");
    expect(html).not.toContain('role="progressbar"');
  });

  it("mounts only the selected progress content and its range controls", () => {
    const html = renderSummary("compliance");

    expect((html.match(/Tiến trình cơ thể và tập luyện/g) || [])).toHaveLength(1);
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
        energy: { latest: 7, latestDateKey: "2026-08-23", count: 2 },
        hunger: { latest: 5, latestDateKey: "2026-08-23", count: 2 },
        stress: { latest: 4, latestDateKey: "2026-08-23", count: 2 },
        soreness: { latest: 3, latestDateKey: "2026-08-23", count: 2 },
        pain: { latest: 1, latestDateKey: "2026-08-23", count: 2 },
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
    expect(html).toContain('data-wellness-selector="desktop"');
    expect(html).toContain('data-wellness-selector="mobile"');
    expect(html).toContain('<optgroup label="Số liệu">');
    expect(html).toContain('<optgroup label="Cảm nhận">');
    expect(html).toContain("Giải thích biểu đồ");
    expect(html).toContain("Biểu đồ chỉ hiển thị những ngày đã gửi dữ liệu");
    expect(html).toContain(
      '<h3 id="wellness-metric-panel-title" class="text-base font-bold text-white">Biểu đồ giấc ngủ (giờ)</h3>',
    );
    expect(html).not.toContain(
      'class="mb-2 text-center text-sm font-semibold text-slate-300"',
    );
    expect(html).not.toContain("rotate(-90)");
    expect(html).not.toContain(">Ngày ghi nhật ký<");
    expect(html).not.toContain("Sức khỏe ngày");
    expect(html).not.toContain(">Hôm nay<");
  });

  it("keeps navigation labels clean and rounds whole-unit averages", () => {
    const renderWellness = (wellness) =>
      renderToStaticMarkup(
        <ProgressSummary
          progress={{ ...progress, wellness }}
          selectedDateKey="2026-08-23"
          activeSection="wellness"
          onSectionChange={vi.fn()}
        />,
      );
    const waterHtml = renderWellness({
      waterMl: { average: 2666.7, count: 3 },
      daily: [{ dateKey: "2026-08-23", waterMl: 2666.7 }],
    });
    const selectorHtml = waterHtml.slice(
      waterHtml.indexOf('data-wellness-selector="mobile"'),
      waterHtml.indexOf('<div id="wellness-metric-panel"'),
    );
    const stepsHtml = renderWellness({
      steps: { average: 42666.7, count: 3 },
      daily: [{ dateKey: "2026-08-23", steps: 42666.7 }],
    });

    expect(selectorHtml).not.toContain("2.667 ml");
    expect(selectorHtml).not.toContain("Chưa có");
    expect(waterHtml).toContain("Trung bình 2.667 ml từ 3 ngày ghi nhận");
    expect(waterHtml).not.toContain("2.666,7");
    expect(stepsHtml).toContain("Trung bình 42.667 bước từ 3 ngày ghi nhận");
    expect(stepsHtml).not.toContain("42.666,7");
  });

  it("presents subjective wellness as the latest semantic state without an average score", () => {
    const wellnessProgress = {
      ...progress,
      wellness: {
        energy: { latest: 6, latestDateKey: "2026-08-23", count: 2 },
        daily: [
          { dateKey: "2026-08-23", energy: 6 },
          { dateKey: "2026-08-21", energy: 3 },
        ],
      },
    };
    const html = renderToStaticMarkup(
      <ProgressSummary
        progress={wellnessProgress}
        selectedDateKey="2026-08-23"
        activeSection="wellness"
        onSectionChange={vi.fn()}
      />,
    );

    expect(html).toContain("Bình thường");
    expect(html).toContain("Biểu đồ năng lượng");
    expect(html).toContain("Gần nhất: Bình thường vào ngày 23/8.");
    expect(html).not.toContain("không quy đổi thành điểm trung bình");
    expect(html).not.toContain("6/10");
    expect(html).not.toContain("Trung bình 6");
  });
});
