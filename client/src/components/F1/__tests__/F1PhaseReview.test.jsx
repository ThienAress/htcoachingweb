import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import F1PhaseReviewForm from "../phaseReview/F1PhaseReviewForm";
import F1PhaseReviewResult from "../phaseReview/F1PhaseReviewResult";

const sampleReview = {
  stageOrder: 1,
  measuredAt: "2027-01-05T05:00:00.000Z",
  actual: { weightKg: 71.8, waistCm: 85 },
  evaluation: {
    total: 83.7,
    decision: "advance",
    breakdown: {
      sessions: { points: 18.2, max: 20 },
      advice: { points: 12.5, max: 20 },
      retest: { points: 27, max: 30 },
      ohsa: { points: 6.7, max: 10 },
      body: { points: 19.4, max: 20 },
    },
    gaps: [
      { text: "Ngủ đủ 7 giờ mỗi đêm", points: 5 },
      { text: "Squat tay qua đầu: hết biểu hiện sai ở mặt bên", points: 3.3 },
    ],
    warnings: [],
    start: { weightKg: 75, waistCm: 88 },
    projected: { weightKg: 71.2, waistCm: 84 },
  },
  nextPhasePlan: {
    stageOrder: 2,
    phaseKey: "phase_3",
    phaseTitle: "Hypertrophy",
    durationWeeks: 10,
    objective: "Tập trung hơn vào phát triển cơ bắp.",
    entryReason: "Khách đạt 83.7% (ngưỡng chuyển là 80%), đủ điều kiện chuyển sang Hypertrophy.",
    keyFocus: ["energy_expenditure"],
    exitCriteria: ["Phản ứng tốt với tăng tải"],
    carryOver: ["Ngủ đủ 7 giờ mỗi đêm"],
  },
  nextOutcome: {
    baseline: { weightKg: 71.8, waistCm: 85 },
    checkpoint: {
      projected: { weightKg: 68.8, waistCm: 82.6 },
      projectedRange: { weightKg: { min: 68.1, max: 69.6 } },
      deltaFromBaseline: { weightKg: -3, waistCm: -2.4 },
    },
    projectionNote: "",
    goalProgress: { summary: "" },
  },
};

describe("F1PhaseReviewResult", () => {
  it("shows the score, the decision, the comparison and the next-stage plan", () => {
    const markup = renderToStaticMarkup(<F1PhaseReviewResult review={sampleReview} />);

    expect(markup).toContain("83,7%");
    expect(markup).toContain("mức hoàn thành");
    expect(markup).toContain("Đủ điều kiện chuyển giai đoạn");
    expect(markup).toContain("Giai đoạn 1: dự kiến và thực tế");
    expect(markup).toContain("71,8 kg");
    expect(markup).toContain("−3,2");
    expect(markup).toContain("Để đạt 90%");
    expect(markup).toContain("Kế hoạch giai đoạn 2: Phát triển cơ bắp (Hypertrophy)");
    expect(markup).toContain("Tăng tiêu hao năng lượng");
    expect(markup).toContain("68,1–69,6");
    expect(markup).not.toContain("energy_expenditure");
  });
});

describe("F1PhaseReviewForm", () => {
  it("lists the recommendations and retests from the stage context", () => {
    const markup = renderToStaticMarkup(
      <F1PhaseReviewForm
        stageOrder={1}
        context={{
          plannedSessions: 30,
          recommendations: ["Ngủ đủ 7 giờ mỗi đêm"],
          retests: [
            { metricKey: "lowerBody", metricLabel: "Sức mạnh thân dưới (Lower Body)", name: "Goblet Squat", tier: "standard", inputMode: "reps", previousLevel: "average" },
            { metricKey: "cardioCapacity", metricLabel: "Năng lực tim mạch (Cardio Capacity)", name: "Treadmill Walk", tier: "easy", inputMode: "", previousLevel: "low" },
          ],
        }}
        saving={false}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(markup).toContain("1. Chỉ số đo lại");
    expect(markup).toContain("Ngủ đủ 7 giờ mỗi đêm");
    expect(markup).toContain("Goblet Squat");
    expect(markup).toContain("Mức tiêu chuẩn");
    expect(markup).toContain("Mức hiện tại (trước: Yếu)");
    expect(markup).toContain("Lưu và đánh giá");
  });
});
