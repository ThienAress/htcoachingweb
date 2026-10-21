import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { selfAssessmentKeys } from "../../../queries/queryKeys";
import SelfAssessmentPage from "../SelfAssessmentPage";

vi.mock("../../../context/AuthContext", () => ({ useAuth: () => ({ user: { _id: "user-1" } }) }));
vi.mock("../../../components/SEO", () => ({ default: () => null }));

const completed = (overrides = {}) => ({
  id: "a1",
  status: "completed",
  draftStep: 4,
  completedAt: "2026-10-01T03:00:00.000Z",
  nextEligibleAt: "2026-10-29T03:00:00.000Z",
  systemFlags: { testPermission: "full_test" },
  result: {
    scoring: {
      overallLevel: "good",
      overallLevelLabel: "Khá",
      metrics: {
        upperBodyPush: { exercise: "Push-Up", variant: "standard", value: 30, level: "very_good", levelLabel: "Tốt", note: "" },
        cardio: { exercise: "Rockport 1-Mile Walk", variant: "standard", value: 14, vo2max: 47.9, level: "good", levelLabel: "Khá", note: "" },
      },
    },
    recommendation: {
      mode: "plan",
      startPhase: { code: "phase_2", label: "Cấp độ 2 · Giai đoạn 2 - Sức mạnh bền (Strength Endurance)", reasons: ["Bạn có kinh nghiệm."] },
      trainingStatus: "intermediate",
      weeklyPlan: { daysPerWeek: 4, recommendedRange: { min: 3, max: 4 }, split: "Thân trên / Thân dưới (Upper/Lower)", sessionTips: ["Khởi động kỹ."] },
      resistance: {
        setsPerExercise: { min: 2, max: 4 },
        repRange: { min: 8, max: 12 },
        rir: { min: 2, max: 3 },
        restSeconds: { min: 60, max: 90 },
        weeklySetsPerMuscle: { min: 8, max: 14 },
      },
      cardio: {
        weeklyMinutes: { min: 150, max: 250 },
        intensity: "moderate_with_intervals",
        intensityNote: "Phần lớn ở cường độ vừa.",
        heartRateZones: { hrMax: 187, moderate: { min: 111, max: 135 }, vigorous: { min: 136, max: 173 } },
      },
      nutrition: {
        proteinGPerKg: { min: 1.6, max: 2.2 },
        proteinGramsPerDay: { min: 128, max: 176 },
        energyAdjustment: "Dư khoảng 5-10% so với TDEE.",
        cautions: [],
        tools: { tdee: "/tdee-calculator", mealPlan: "/mealplan" },
      },
      recovery: { sleepTargetHours: { min: 7, max: 9 }, notes: [] },
      dailyActivity: { stepsTarget: { min: 8000, max: 10000 } },
      focusAreas: [{ metric: "lowerBody", label: "Sức mạnh thân dưới (Lower Body)", level: null, levelLabel: "Chưa xếp mức", exercises: ["Goblet Squat"] }],
      cautions: ["Đầu gối: giảm độ sâu."],
      insights: [{ key: "bmi", label: "Chỉ số khối cơ thể (BMI)", value: 26, status: "obese_1", message: "BMI cao." }],
      libraryPath: "/exercises",
      references: ["WHO (2020)."],
    },
  },
  ...overrides,
});

const render = (state) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(selfAssessmentKeys.mine("user-1"), state);
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SelfAssessmentPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const base = { canWrite: true, draft: null, latestCompleted: null, retest: { recommendedAfterDays: 28, nextEligibleAt: null, isEarly: false } };

describe("Trang Đánh giá bản thân", () => {
  it("Fitness+ chưa có đánh giá thấy lời mời bắt đầu", () => {
    const html = render(base);
    expect(html).toContain("Đánh giá bản thân");
    expect(html).toContain("Bắt đầu đánh giá");
  });

  it("hiện kết quả, nhóm ưu tiên, liên kết thư viện bài tập và nhắc làm lại sau 28 ngày", () => {
    const html = render({
      ...base,
      latestCompleted: completed(),
      retest: { recommendedAfterDays: 28, nextEligibleAt: "2026-10-29T03:00:00.000Z", isEarly: true },
    });
    expect(html).toContain("Mức thể lực tổng: Khá");
    expect(html).toContain("Giai đoạn 2 - Sức mạnh bền (Strength Endurance)");
    expect(html).toContain("Goblet Squat");
    expect(html).toContain('href="/exercises"');
    expect(html).toContain('href="/tdee-calculator"');
    expect(html).toContain("Nên làm lại sau 28 ngày");
    expect(html).toContain("Làm lại đánh giá");
    expect(html).toContain("Béo phì độ 1");
  });

  it("không lộ enum thô ra giao diện", () => {
    const html = render({ ...base, latestCompleted: completed() });
    ["moderate_with_intervals", "needs_improvement", "very_good", "obese_1", "full_test", "intermediate"].forEach((raw) => {
      expect(html).not.toContain(raw);
    });
  });

  it("gói hết hạn: xem lại được kết quả nhưng không có nút làm lại", () => {
    const html = render({ ...base, canWrite: false, latestCompleted: completed() });
    expect(html).toContain("chỉ xem lại được kết quả");
    expect(html).toContain("Gia hạn gói");
    expect(html).not.toContain("Làm lại đánh giá");
    expect(html).toContain("Mức thể lực tổng: Khá");
  });

  it("chưa có gói và chưa từng làm: thẻ mời mua HT Fitness+", () => {
    const html = render({ ...base, canWrite: false });
    expect(html).toContain("dành cho thành viên HT Fitness+");
    expect(html).toContain('href="/?plan=fitness-plus#pricing"');
    expect(html).not.toContain("Bắt đầu đánh giá");
  });

  it("bản nháp đã lưu bước 1 thì tiếp tục ở bước 2", () => {
    const html = render({
      ...base,
      draft: { id: "d1", status: "draft", draftStep: 1, consent: { allowDataStorage: true }, systemFlags: { testPermission: "full_test" } },
    });
    expect(html).toContain("Số đo cơ bản");
    expect(html).toContain("Hồ sơ tập luyện");
  });

  it("sàng lọc bị khóa thì ở bước 3 chỉ có lời khuyên an toàn, không có bài kiểm tra", () => {
    const html = render({
      ...base,
      draft: { id: "d1", status: "draft", draftStep: 2, consent: { allowDataStorage: true }, systemFlags: { testPermission: "hold_test" } },
    });
    expect(html).toContain("Chưa nên làm bài kiểm tra thể lực");
    expect(html).not.toContain("Rockport 1-Mile Walk");
  });

  it("không có ô chọn gốc và không có ô tải tệp", () => {
    const wizard = render({
      ...base,
      draft: { id: "d1", status: "draft", draftStep: 1, consent: { allowDataStorage: true } },
    });
    const tests = render({
      ...base,
      draft: { id: "d1", status: "draft", draftStep: 2, consent: { allowDataStorage: true }, systemFlags: { testPermission: "full_test" } },
    });
    [wizard, tests].forEach((html) => {
      expect(html).not.toContain("<select");
      expect(html).not.toContain('type="file"');
    });
    expect(tests).toContain("Rockport 1-Mile Walk");
    expect(tests).toContain("Push-Up");
  });
});
