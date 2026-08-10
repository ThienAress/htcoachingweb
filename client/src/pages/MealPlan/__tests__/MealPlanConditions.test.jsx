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

  it("states explicitly that budget is optional", () => {
    expect(renderConditions()).toContain(
      "Ngân sách tham khảo mỗi ngày — không bắt buộc",
    );
  });

  it("shows Vietnamese symptom guidance and emergency action", () => {
    const html = renderConditions({ allergyStatus: "unsure" });

    expect(html).toContain("Dấu hiệu thường gặp sau khi ăn");
    expect(html).toContain("Nổi mề đay, mẩn đỏ hoặc ngứa");
    expect(html).toContain("gọi cấp cứu 115");
    expect(html).toContain("không đủ để tự chẩn đoán");
  });

  it("lists exactly ten common symptoms", () => {
    const html = renderConditions();

    expect(html.match(/<li(?:\s|>)/g)).toHaveLength(10);
  });
});
