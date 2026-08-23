import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  TrainerJournalSummary,
  TrainerWeeklyReviewAnchor,
} from "../TrainerClientOverview";
import { TrainerWeeklyMeasurements } from "../TrainerWeeklyReview";

describe("TrainerJournalSummary", () => {
  it("exposes the journal anchor and only the shared note", () => {
    const html = renderToStaticMarkup(
      <TrainerJournalSummary
        dateKey="2026-08-23"
        journal={{
          status: "submitted",
          wellness: { sleepHours: 7.5, energy: 8 },
          notes: { shared: "Hôm nay tập tốt", private: "Không chia sẻ" },
        }}
      />,
    );

    expect(html).toContain('id="journal"');
    expect(html).toContain("Hôm nay tập tốt");
    expect(html).toContain("Rất sung sức");
    expect(html).not.toContain("Không chia sẻ");
  });

  it("exposes the stable weekly report anchor", () => {
    const html = renderToStaticMarkup(
      <TrainerWeeklyReviewAnchor>
        <p>Báo cáo tuần</p>
      </TrainerWeeklyReviewAnchor>,
    );

    expect(html).toContain('id="weekly-report"');
  });

  it("does not expose an unsubmitted journal to the trainer", () => {
    const html = renderToStaticMarkup(
      <TrainerJournalSummary
        dateKey="2026-08-23"
        journal={{
          status: "draft",
          wellness: { energy: 9 },
          notes: { shared: "Nội dung chưa gửi" },
        }}
      />,
    );

    expect(html).toContain("Chưa có nhật ký đã gửi cho ngày này");
    expect(html).not.toContain("Nội dung chưa gửi");
    expect(html).not.toContain("Rất sung sức");
  });

  it("shows all four weekly measurements without inventing missing values", () => {
    const html = renderToStaticMarkup(
      <TrainerWeeklyMeasurements
        body={{
          weightKg: 72.5,
          waistCm: 82,
          bodyFatPercent: 18.5,
          skeletalMusclePercent: null,
        }}
      />,
    );

    expect(html).toContain("72,5 kg");
    expect(html).toContain("18,5 %");
    expect(html).toContain("Tỷ lệ cơ xương");
    expect(html).toContain("Chưa ghi");
  });
});
