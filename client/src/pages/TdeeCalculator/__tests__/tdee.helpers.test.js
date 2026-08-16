import { describe, expect, it } from "vitest";
import {
  ACTIVITY_BANDS,
  calculateTdeeEstimate,
  createDefaultTdeeForm,
  normalizeStoredTdeeForm,
  recommendActivityBand,
  updateTrainingEvidence,
} from "../tdee.helpers";

describe("TDEE safe defaults", () => {
  it("chỉ chọn sẵn Mifflin-St Jeor, không đoán activity hoặc goal", () => {
    expect(createDefaultTdeeForm()).toEqual({
      gender: "",
      height: "",
      weight: "",
      age: "",
      activity: "",
      dailyMovement: "",
      steps: "",
      trainingFrequency: "",
      trainingDuration: "",
      trainingIntensity: "",
      formula: "Mifflin-St Jeor",
      bodyfat: "",
      goal: "",
      customCalorieAdjustment: "",
    });
  });

  it("normalize formula trống từ dữ liệu cũ nhưng giữ công thức hợp lệ", () => {
    expect(normalizeStoredTdeeForm({ formula: "", weight: "70" })).toMatchObject({
      formula: "Mifflin-St Jeor",
      weight: "70",
      activity: "",
      goal: "",
    });
    expect(
      normalizeStoredTdeeForm({ formula: "Katch-McArdle", bodyfat: "18" }),
    ).toMatchObject({ formula: "Katch-McArdle", bodyfat: "18" });
  });

  it("mỗi lần tạo default trả object độc lập", () => {
    const first = createDefaultTdeeForm();
    first.weight = "80";

    expect(createDefaultTdeeForm().weight).toBe("");
  });
});

describe("TDEE whole-day activity estimate", () => {
  it("không đề xuất hệ số khi thiếu bằng chứng vận động cả ngày", () => {
    expect(
      recommendActivityBand({
        dailyMovement: "mostly_seated",
        steps: "unknown",
        trainingFrequency: "five_plus",
        trainingDuration: "over_60",
        trainingIntensity: "vigorous",
      }),
    ).toBeNull();
  });

  it("không suy hệ số cao chỉ từ 5+ buổi tập của người chủ yếu ngồi", () => {
    expect(
      recommendActivityBand({
        dailyMovement: "mostly_seated",
        steps: "under_5000",
        trainingFrequency: "five_plus",
        trainingDuration: "between_45_60",
        trainingIntensity: "moderate",
      }),
    ).toMatchObject({
      key: "moderate",
      multiplier: 1.55,
      range: [1.5, 1.6],
    });
  });

  it("trả estimate trung tâm và khoảng bất định từ band đã xác nhận", () => {
    expect(
      calculateTdeeEstimate(1600, ACTIVITY_BANDS.moderate),
    ).toEqual({ estimate: 2480, range: { min: 2400, max: 2560 } });
  });

  it("chấp nhận không tập mà không bịa thời lượng hoặc cường độ", () => {
    expect(
      recommendActivityBand({
        dailyMovement: "mostly_seated",
        steps: "under_5000",
        trainingFrequency: "none",
        trainingDuration: "none",
        trainingIntensity: "none",
      }),
    ).toMatchObject({ key: "sedentary", multiplier: 1.2 });
  });

  it("fail closed khi trạng thái không tập mâu thuẫn với thời lượng hoặc cường độ", () => {
    expect(
      recommendActivityBand({
        dailyMovement: "mostly_seated",
        steps: "under_5000",
        trainingFrequency: "none",
        trainingDuration: "over_60",
        trainingIntensity: "vigorous",
      }),
    ).toBeNull();
  });

  it("đồng bộ evidence khi chuyển qua lại giữa không tập và có tập", () => {
    const noTraining = updateTrainingEvidence(
      {
        trainingFrequency: "five_plus",
        trainingDuration: "between_45_60",
        trainingIntensity: "moderate",
      },
      "trainingFrequency",
      "none",
    );
    expect(noTraining).toMatchObject({
      trainingFrequency: "none",
      trainingDuration: "none",
      trainingIntensity: "none",
    });

    expect(
      updateTrainingEvidence(noTraining, "trainingFrequency", "one_two"),
    ).toMatchObject({
      trainingFrequency: "one_two",
      trainingDuration: "",
      trainingIntensity: "",
    });
  });
});
