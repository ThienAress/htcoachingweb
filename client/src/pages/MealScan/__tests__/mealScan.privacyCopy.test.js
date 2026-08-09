import { describe, expect, test } from "vitest";

import en from "../../../i18n/locales/en/mealScan.json";
import vi from "../../../i18n/locales/vi/mealScan.json";

describe("Meal Scan unpaid provider disclosure", () => {
  test("discloses Google Gemini data use before the user confirms", () => {
    expect({
      vi: vi.confirm_analysis.description,
      en: en.confirm_analysis.description,
    }).toEqual({
      vi: expect.stringMatching(/Google Gemini.*có thể.*cải thiện/i),
      en: expect.stringMatching(/Google Gemini.*may.*improve/i),
    });
  });
});
