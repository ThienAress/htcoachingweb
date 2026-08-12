import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("../MealPlan.jsx", import.meta.url)),
  "utf8",
);
const viLocale = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL("../../../i18n/locales/vi/mealplan.json", import.meta.url),
    ),
    "utf8",
  ),
);

describe("Meal Plan safety lock wiring", () => {
  it("labels the generated menu tab as a system suggestion", () => {
    expect(viLocale.tab_menu).toBe("📋 Hệ thống gợi ý thực đơn");
  });

  it("guards both generation and favorites until preferences are confirmed", () => {
    expect(source).toMatch(
      /const handleGenerateMeal = async \(\) => \{\s*if \(areMealPlanActionsLocked\) return;/,
    );
    expect(source).toMatch(
      /const handleOpenFavorites = \(\) => \{\s*if \(areMealPlanActionsLocked\) return;/,
    );
  });

  it("passes the safety lock to both generation and favorites native disabled states", () => {
    expect(source).toMatch(
      /<MealButton[\s\S]*?disabled=\{[\s\S]*?areMealPlanActionsLocked[\s\S]*?\}/,
    );
    expect(source).toMatch(
      /<button\s+type="button"\s+onClick=\{handleOpenFavorites\}\s+disabled=\{areMealPlanActionsLocked\}/,
    );
  });

  it("does not save a draft implicitly while generating a meal plan", () => {
    const generateStart = source.indexOf("const handleGenerateMeal = async");
    const generateEnd = source.indexOf("const handlePreferenceChange");
    const generateHandler = source.slice(generateStart, generateEnd);

    expect({
      foundHandler: generateStart >= 0 && generateEnd > generateStart,
      implicitSave: generateHandler.includes("preferenceQuery.save"),
    }).toEqual({ foundHandler: true, implicitSave: false });
  });

  it("opens confirmation actions before save or clear mutations", () => {
    expect({
      saveDialog: source.includes('setPreferenceConfirmationAction("save")'),
      clearDialog: source.includes('setPreferenceConfirmationAction("clear")'),
      confirmDialog: source.includes("<MealPlanPreferenceConfirmDialog"),
    }).toEqual({ saveDialog: true, clearDialog: true, confirmDialog: true });
  });

  it("passes the API-backed account snapshot separately from the editable draft", () => {
    expect(source).toMatch(
      /<MealPlanConditions[\s\S]*?preferences=\{mealPlanPreferences\}[\s\S]*?savedPreferences=\{preferenceQuery\.preferences \|\| null\}/,
    );
  });
});
