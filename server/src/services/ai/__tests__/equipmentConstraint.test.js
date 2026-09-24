import { describe, expect, it } from "vitest";

import { validateWorkoutEquipmentOutput } from "../equipmentConstraint.js";

describe("workout equipment output guard", () => {
  it("rejects machine and bench exercises when user has only dumbbells and bands", () => {
    const result = validateWorkoutEquipmentOutput(
      "Tôi chỉ có tạ đơn điều chỉnh và dây kháng lực",
      "Ngày 1: Barbell bench press 4 hiệp; cable fly 3 hiệp.",
    );

    expect(result.valid).toBe(false);
    expect(result.reasonCodes).toContain("unsupported_equipment");
  });

  it("accepts floor press as an explicit safe dumbbell variant", () => {
    expect(
      validateWorkoutEquipmentOutput(
        "Tôi chỉ có tạ đơn điều chỉnh và dây kháng lực",
        "Dumbbell floor press trên sàn, 3 hiệp.",
      ).valid,
    ).toBe(true);
  });
});
