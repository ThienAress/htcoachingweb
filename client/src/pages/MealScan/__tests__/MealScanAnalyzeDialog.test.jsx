import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

import MealScanAnalyzeDialog from "../MealScanAnalyzeDialog.jsx";

describe("MealScanAnalyzeDialog consent", () => {
  test("renders explicit unchecked consent and disables confirmation by default", () => {
    const markup = renderToStaticMarkup(
      <MealScanAnalyzeDialog
        open
        accepted={false}
        onAcceptedChange={() => {}}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );

    expect(markup).toContain('type="checkbox"');
    expect(markup).not.toContain('checked=""');
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>confirm_analysis\.confirm/su);
  });

  test("enables confirmation only after explicit opt-in", () => {
    const markup = renderToStaticMarkup(
      <MealScanAnalyzeDialog
        open
        accepted
        onAcceptedChange={() => {}}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );

    expect(markup).toContain('checked=""');
    expect(markup).not.toMatch(/<button[^>]*disabled=""[^>]*>confirm_analysis\.confirm/su);
  });
});
