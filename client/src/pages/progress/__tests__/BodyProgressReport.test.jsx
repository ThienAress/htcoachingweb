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
    expect(html).toContain("-1 kg");
    expect(html).toContain("78");
    expect(html).toContain("-2 cm");
    expect(html).toContain("Báo cáo tuần đã gửi hoặc được duyệt");
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
});
