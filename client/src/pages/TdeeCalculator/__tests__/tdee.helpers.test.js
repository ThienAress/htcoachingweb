import { describe, expect, it } from "vitest";
import {
  createDefaultTdeeForm,
  normalizeStoredTdeeForm,
} from "../tdee.helpers";

describe("TDEE safe defaults", () => {
  it("chỉ chọn sẵn Mifflin-St Jeor, không đoán activity hoặc goal", () => {
    expect(createDefaultTdeeForm()).toEqual({
      gender: "",
      height: "",
      weight: "",
      age: "",
      activity: "",
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
