import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BodyProgressReport } from "../BodyProgressReport";

const renderReport = (bodyProgress) =>
  renderToStaticMarkup(<BodyProgressReport bodyProgress={bodyProgress} />);

describe("BodyProgressReport", () => {
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
    expect((html.match(/role="tab"/g) || [])).toHaveLength(4);
    expect(html).toContain('aria-selected="true"');
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

    expect((html.match(/role="tab"/g) || [])).toHaveLength(4);
    expect((html.match(/Chưa có dữ liệu/g) || [])).toHaveLength(5);
    expect(html).not.toContain('data-body-metric-chart="true"');
  });
});
