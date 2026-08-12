import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import MealPlanConditions from "../MealPlanConditions";

const renderConditions = (preferences = {}, props = {}) =>
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
      onClear={() => {}}
      isSaving={false}
      isClearing={false}
      isDirty={false}
      isConfirmed={false}
      foodDatabase={[]}
      savedPreferences={null}
      {...props}
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

  it("disables account save and shows the concise safety lock copy when unsure", () => {
    const html = renderConditions({ allergyStatus: "unsure" }, { isDirty: true });

    expect(html).toContain(
      "Hãy kiểm tra kĩ hoặc trao đổi với bác sĩ/chuyên gia dinh dưỡng trước khi dùng gợi ý. Hệ thống tạm khóa đến khi có kết quả chính xác",
    );
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Lưu điều kiện vào tài khoản<\/button>/);
  });

  it("shows only the account snapshot in the previously saved allergen section", () => {
    const html = renderConditions(
      { allergens: ["milk"], otherAllergenText: "" },
      {
        savedPreferences: {
          allergyStatus: "declared",
          allergens: ["fish"],
          otherAllergenText: "Gà",
        },
      },
    );
    const savedSection = html.match(
      /<section[^>]*aria-labelledby="saved-meal-plan-allergens-title"[^>]*>([\s\S]*?)<\/section>/,
    )?.[1];

    expect({
      hasHeading: savedSection?.includes("Các thực phẩm dị ứng đã lưu trước đó"),
      hasSavedFoods:
        savedSection?.includes("Cá") && savedSection?.includes("Gà"),
      excludesUnsavedDraft: !savedSection?.includes("Sữa"),
    }).toEqual({
      hasHeading: true,
      hasSavedFoods: true,
      excludesUnsavedDraft: true,
    });
  });

  it("shows a clear empty account snapshot before the first save", () => {
    const html = renderConditions({}, { savedPreferences: null });

    expect(html).toContain("Chưa có thực phẩm dị ứng nào được lưu vào tài khoản.");
  });

  it("locks every allergy control and shows clear action after confirmation", () => {
    const html = renderConditions(
      { allergens: ["fish"], otherAllergenText: "Cá thu" },
      {
        isConfirmed: true,
        savedPreferences: {
          allergyStatus: "declared",
          allergens: ["fish"],
          otherAllergenText: "Cá thu",
        },
      },
    );

    expect({
      disabledFieldsets: (html.match(/<fieldset[^>]*disabled=""/g) || []).length,
      saveDisabled: html.includes(">Đã lưu vào tài khoản</button>"),
      clearAction: html.includes(">Bỏ lưu điều kiện</button>"),
    }).toEqual({ disabledFieldsets: 2, saveDisabled: true, clearAction: true });
  });

  it("recognizes cá thu from the current Food catalog in the UI", () => {
    const html = renderConditions(
      { otherAllergenText: "cá thu" },
      { foodDatabase: [{ label: "Cá thu" }, { label: "Cá chẽm" }] },
    );

    expect({
      recognized: html.includes("Cá thu"),
      notUnmapped: !html.includes("Cá thu — chưa nhận diện"),
    }).toEqual({ recognized: true, notUnmapped: true });
  });

  it("reassures the user when a specific allergen is absent from the Food catalog", () => {
    const html = renderConditions(
      { otherAllergenText: "cá thu" },
      { foodDatabase: [{ label: "Cá chẽm" }] },
    );

    expect(html).toContain(
      "Thực phẩm này không có trong hệ thống thức ăn nên hệ thống sẽ không gợi ý trong thực đơn. Bạn yên tâm.",
    );
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
