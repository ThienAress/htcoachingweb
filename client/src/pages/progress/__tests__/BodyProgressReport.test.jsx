import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BodyProgressReport } from "../BodyProgressReport";

const renderReport = (bodyProgress) =>
  renderToStaticMarkup(<BodyProgressReport bodyProgress={bodyProgress} />);

describe("BodyProgressReport", () => {
  it("shows hip, abdomen and unitless ratio history without fabricating missing points", () => {
    const html = renderReport({
      hipCm: { unit: "cm", current: { dateKey: "2026-09-07", value: 100 }, delta: -1, series: [{ dateKey: "2026-09-07", value: 100 }] },
      abdomenCm: { unit: "cm", current: { dateKey: "2026-09-07", value: 88 }, delta: null, series: [{ dateKey: "2026-09-07", value: 88 }] },
      waistHipRatio: { unit: "", current: { dateKey: "2026-09-07", value: 0.8 }, delta: -0.02, series: [{ dateKey: "2026-09-07", value: 0.8 }] },
    });
    expect(html).toContain("Vòng hông");
    expect(html).toContain("Vòng bụng");
    expect(html).toContain("Tỷ lệ eo/hông");
    expect(html).toContain("100 cm");
    expect(html).toContain("88 cm");
    expect(html).toContain("−0,02");
    expect(html).not.toContain("0,8%");
    expect(html).not.toContain(">0 cm<");
  });
  it("renders a ratio chart without a percent unit or empty unit parentheses", () => {
    const html = renderReport({ waistHipRatio: {
      unit: "", current: { dateKey: "2026-09-07", value: 0.825 }, delta: null,
      series: [{ dateKey: "2026-09-07", value: 0.825 }],
    } });
    expect(html).toContain("0,825");
    expect(html).not.toContain("eo/hông ()");
    expect(html).not.toContain("0,825%");
  });
  it("renders current values, deltas and the canonical source semantics", () => {
    const html = renderReport({
      source: {
        type: "weekly_checkin",
        includedStatuses: ["submitted", "reviewed"],
        dateField: "weekStartDateKey",
      },
      weightKg: {
        unit: "kg",
        current: { dateKey: "2026-07-20", value: 69 },
        delta: -1,
        series: [
          { dateKey: "2026-07-06", value: 70 },
          { dateKey: "2026-07-20", value: 69 },
        ],
      },
      waistCm: {
        unit: "cm",
        current: { dateKey: "2026-07-20", value: 78 },
        delta: -2,
        series: [
          { dateKey: "2026-07-06", value: 80 },
          { dateKey: "2026-07-20", value: 78 },
        ],
      },
    });

    expect(html).toContain("Tiến trình cơ thể");
    expect(html).toContain("69");
    expect(html).toContain("−1 kg");
    expect(html).toContain("78");
    expect(html).toContain("−2 cm");
    expect(html).toContain("Báo cáo tuần đã gửi hoặc được duyệt");
    expect((html.match(/data-body-metric-chart="true"/g) || [])).toHaveLength(1);
    expect((html.match(/role="tab"/g) || [])).toHaveLength(7);
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain("Giải thích biểu đồ");
    expect(html).toContain("Biểu đồ chỉ hiển thị những kỳ đã có số đo");
    expect(html).toContain(
      "Đường nét đứt thể hiện lần đo đầu tiên trong khoảng đang xem",
    );
    expect(html).toContain(
      '<h3 class="text-base font-bold text-white">Biểu đồ cân nặng (kg)</h3>',
    );
    expect(html).not.toContain(
      'class="mb-2 text-center text-sm font-semibold text-slate-300"',
    );
    expect(html).not.toContain("rotate(-90)");
    expect(html).not.toContain(">Kỳ báo cáo<");
  });

  it("shows missing waist data as unavailable instead of zero", () => {
    const html = renderReport({
      weightKg: {
        unit: "kg",
        current: { dateKey: "2026-07-20", value: 69 },
        delta: null,
        series: [{ dateKey: "2026-07-20", value: 69 }],
      },
      waistCm: { unit: "cm", current: null, delta: null, series: [] },
    });

    expect(html).toContain("Chưa có số đo vòng eo");
    expect(html).not.toContain(">0 cm<");
  });

  it("renders body fat and skeletal muscle as first-class measurements", () => {
    const html = renderReport({
      weightKg: { unit: "kg", current: null, delta: null, series: [] },
      waistCm: { unit: "cm", current: null, delta: null, series: [] },
      bodyFatPercent: {
        unit: "%",
        current: { dateKey: "2026-08-17", value: 18.5 },
        delta: -0.7,
        series: [{ dateKey: "2026-08-17", value: 18.5 }],
      },
      skeletalMusclePercent: {
        unit: "%",
        current: { dateKey: "2026-08-17", value: 42 },
        delta: 1.2,
        series: [{ dateKey: "2026-08-17", value: 42 }],
      },
    });

    expect(html).toContain("Tỷ lệ mỡ cơ thể");
    expect(html).toContain("18,5");
    expect(html).toContain("Tỷ lệ cơ xương");
    expect(html).toContain("42");
  });

  it("keeps all selectors visible while rendering one clear empty state", () => {
    const html = renderReport({
      weightKg: { unit: "kg", current: null, delta: null, series: [] },
      waistCm: { unit: "cm", current: null, delta: null, series: [] },
      bodyFatPercent: { unit: "%", current: null, delta: null, series: [] },
      skeletalMusclePercent: {
        unit: "%",
        current: null,
        delta: null,
        series: [],
      },
    });

    expect((html.match(/role="tab"/g) || [])).toHaveLength(7);
    expect((html.match(/Chưa có dữ liệu/g) || [])).toHaveLength(8);
    expect(html).not.toContain('data-body-metric-chart="true"');
  });
});
