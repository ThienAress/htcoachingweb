import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import MealPlanConditions from "../MealPlanConditions";

const renderConditions = (preferences = {}) =>
  renderToStaticMarkup(
    <MealPlanConditions
      preferences={{
        allergyStatus: "declared",
        allergens: [],
        otherAllergenText: "",
        budgetVndPerDay: null,
        ...preferences,
      }}
      onChange={() => {}}
      isAuthenticated
      isLoading={false}
      isError={false}
      onRetry={() => {}}
      onSave={() => {}}
      isSaving={false}
      isDirty={false}
    />,
  );

describe("MealPlanConditions", () => {
  it("uses the approved allergy question and option copy", () => {
    const html = renderConditions();

    expect(html).toContain(
      "Bạn có dị ứng thực phẩm không?",
    );
    expect(html).toContain("Không có dị ứng");
    expect(html).toContain("Có, chọn nhóm bên dưới");
  });

  it("renders a bounded other-allergen input", () => {
    const html = renderConditions();

    expect(html).toContain('name="meal-plan-other-allergen"');
    expect(html).toContain('maxLength="120"');
  });

  it("shows a recognized chicken tag without requiring another checkbox", () => {
    const html = renderConditions({ otherAllergenText: "thịt gà" });

    expect(html).toContain("Gà");
    expect(html).toContain("không cần tick thêm ô phía trên");
  });

  it("warns against periods used between foods", () => {
    const html = renderConditions({ otherAllergenText: "bò.gà.heo" });

    expect(html).toContain("Không dùng dấu chấm giữa các thực phẩm");
  });

  it("asks for a specific type when meat is too generic", () => {
    const html = renderConditions({ otherAllergenText: "thịt" });

    expect(html).toContain("Nhập “thịt” còn quá chung chung");
    expect(html).toContain("gà, bò, heo");
    expect(html).not.toContain("Đồng ý");
    expect(html).not.toContain("Hủy xác nhận");
  });

  it("does not render the removed daily budget input", () => {
    expect(renderConditions()).not.toContain(
      'name="meal-plan-budget-vnd-per-day"',
    );
  });

  it("shows Vietnamese symptom guidance without the removed 115 warning", () => {
    const html = renderConditions({ allergyStatus: "unsure" });

    expect([
      html.includes("Dấu hiệu thường gặp sau khi ăn"),
      html.includes("Nổi mề đay, mẩn đỏ hoặc ngứa"),
      html.includes("không đủ để tự chẩn đoán"),
      html.includes("gọi cấp cứu 115"),
    ]).toEqual([true, true, true, false]);
  });

  it("does not render dead health links or the removed source section", () => {
    const html = renderConditions();

    expect([
      html.includes("vncdc.gov.vn"),
      html.includes("moh.gov.vn"),
      html.includes("Nguồn &amp; giới hạn tham khảo"),
    ]).toEqual([false, false, false]);
  });

  it("lists exactly ten common symptoms", () => {
    const html = renderConditions();

    expect(html.match(/<li(?:\s|>)/g)).toHaveLength(10);
  });
});
