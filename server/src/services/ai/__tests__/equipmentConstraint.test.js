import { describe, expect, it } from "vitest";

import {
  hasLimitedDumbbellBandConstraint,
  validateWorkoutEquipmentOutput,
} from "../equipmentConstraint.js";

const prompt =
  "Tạo lịch tăng cơ 4 ngày/tuần cho người mới, chỉ có đôi tạ đơn điều chỉnh và dây kháng lực.";

describe("AI workout equipment constraint", () => {
  it("nhận diện đúng ràng buộc tạ đơn và dây trong prompt acceptance", () => {
    expect(hasLimitedDumbbellBandConstraint(prompt)).toBe(true);
  });

  it("chặn bài cần ghế, máy, cáp hoặc thanh đòn", () => {
    const result = validateWorkoutEquipmentOutput(
      prompt,
      "Buổi 1: Barbell Bench Press. Buổi 2: Cable Chest Fly.",
    );

    expect(result).toMatchObject({
      applies: true,
      valid: false,
      reasonCodes: ["unsupported_equipment"],
    });
  });

  it("chặn các setup ngoài phạm vi như xà đơn, TRX, kettlebell, ghế, box và dip station", () => {
    const result = validateWorkoutEquipmentOutput(
      prompt,
      [
        "Pull-up trên xà đơn.",
        "TRX Row.",
        "Kettlebell Swing.",
        "Chair Dips.",
        "Box Jump.",
        "Dips trên dip station.",
      ].join("\n"),
    );

    expect(result.reasonCodes).toContain("unsupported_equipment");
  });

  it("chặn dumbbell chest press mơ hồ chưa nêu biến thể sàn", () => {
    const result = validateWorkoutEquipmentOutput(
      prompt,
      "Buổi 1: Dumbbell Chest Press — 4 hiệp x 10 lần.",
    );

    expect(result.reasonCodes).toContain("ambiguous_dumbbell_press_setup");
  });

  it("cho phép floor press, shoulder press đứng và resistance-band press", () => {
    const result = validateWorkoutEquipmentOutput(
      prompt,
      [
        "Dumbbell Floor Press trên sàn, không cần ghế.",
        "Standing Dumbbell Shoulder Press.",
        "Resistance Band Chest Press.",
      ].join("\n"),
    );

    expect(result).toMatchObject({ applies: true, valid: true, reasonCodes: [] });
  });

  it("không áp guard vào prompt không giới hạn thiết bị", () => {
    expect(
      validateWorkoutEquipmentOutput(
        "Lập lịch tập tại phòng gym đầy đủ thiết bị.",
        "Barbell Bench Press và Cable Chest Fly.",
      ),
    ).toMatchObject({ applies: false, valid: true });
  });
});
