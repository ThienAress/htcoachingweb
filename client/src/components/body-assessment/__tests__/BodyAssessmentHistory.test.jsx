import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BodyAssessmentHistory } from "../BodyAssessmentHistory";

const record = (dateKey, value, deviceLabel = "InBody A") => ({
  published: {
    measuredDateKey: dateKey,
    deviceLabel,
    referenceBasis: "device-standard",
    segments: { trunk: { leanKg: value, leanReferencePercent: value } },
  },
});
const renderHistory = (items, props = {}) => renderToStaticMarkup(
  <BodyAssessmentHistory items={items} region="trunk" field="leanKg" unit="kg" referenceSnapshot={items.at(-1)?.published} {...props} />,
);

describe("BodyAssessmentHistory", () => {
  it("defaults to the latest measured year and renders only day/month axis labels", () => {
    const html = renderHistory([record("2025-12-31", 24), record("2026-01-02", 25)]);
    expect(html).toContain("trong năm 2026, 1 điểm đo");
    expect(html).toContain("Bụng — khối cơ nạc");
    expect(html).toContain(">02-01<");
    expect(html).not.toContain(">31-12<");
  });

  it("keeps missing reference values as gaps while offering focusable numeric points", () => {
    const current = record("2026-09-08", 110);
    const mismatched = record("2026-09-04", 105, "Different device");
    const html = renderHistory([record("2026-09-01", 100), mismatched, current], {
      field: "leanReferencePercent", unit: "%", referenceSnapshot: current.published,
    });
    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
    expect(html).not.toContain("Điểm đang chọn:");
    expect(html).not.toContain("105 %");
  });

  it("renders numeric Y-axis ticks and a clear constant-value single-point state without the old table", () => {
    const html = renderHistory([record("2026-09-08", 28)]);
    expect(html).toContain(">kg</text>");
    expect(html).toContain('data-axis="y"');
    expect(html).toContain('stroke-orange-400');
    expect(html).not.toContain('stroke-cyan-400');
    expect(html).toContain('aria-label="Năm đo"');
    expect(html).not.toContain('>Năm đo');
    expect(html).toContain("Mới có một điểm đo phù hợp, chưa có xu hướng.");
    expect(html).not.toContain("Xem số liệu lịch sử vùng này");
  });
});
