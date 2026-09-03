import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  MAX_ADDITIONAL_RECIPE_NUTRIENTS,
  recipeNutritionFormValues,
  recipeNutritionPayload,
} from "../recipeNutritionForm";
import RecipeNutritionEditor from "../RecipeNutritionEditor.jsx";

describe("RecipeNutritionEditor helpers", () => {
  it("chuyển dữ liệu form admin thành số cho API", () => {
    const form = recipeNutritionFormValues({
      calories: 361,
      protein: 32,
      fat: 8,
      carb: 40,
      sugars: 6,
      salt: 1.2,
      additional: [{ label: "Chất xơ", unit: "g", value: 7 }],
    });
    expect(recipeNutritionPayload(form)).toEqual({
      calories: 361,
      protein: 32,
      fat: 8,
      carb: 40,
      sugars: 6,
      salt: 1.2,
      additional: [{ label: "Chất xơ", unit: "g", value: 7 }],
    });
  });

  it("đồng bộ giới hạn 60 thành phần dinh dưỡng bổ sung", () => {
    expect(MAX_ADDITIONAL_RECIPE_NUTRIENTS).toBe(60);
  });

  it("quy đổi dữ liệu mg cũ sang g khi mở và gửi form", () => {
    const form = recipeNutritionFormValues({
      calories: 361,
      protein: 32,
      fat: 8,
      carb: 40,
      sugars: 6,
      salt: 1.2,
      additional: [{ label: "Natri", unit: "mg", value: 5 }],
    });

    expect({
      form: form.additional[0],
      payload: recipeNutritionPayload(form).additional[0],
    }).toEqual({
      form: expect.objectContaining({
        label: "Natri",
        unit: "g",
        value: 0.005,
      }),
      payload: { label: "Natri", unit: "g", value: 0.005 },
    });
  });

  it("không cho nhập mới đơn vị mg nhưng vẫn giữ mcg", () => {
    const html = renderToStaticMarkup(
      createElement(RecipeNutritionEditor, {
        value: recipeNutritionFormValues({
          additional: [{ label: "Vitamin B12", unit: "mcg", value: 1.2 }],
        }),
        onChange: vi.fn(),
      }),
    );

    expect({
      hasMg: html.includes('<option value="mg">'),
      hasMcg: html.includes('<option value="mcg" selected="">'),
    }).toEqual({ hasMg: false, hasMcg: true });
  });
});
