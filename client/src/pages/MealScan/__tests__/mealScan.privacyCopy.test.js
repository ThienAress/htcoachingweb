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

  test("describes the one guest scan plus one account scan funnel", () => {
    expect({
      viHint: vi.uploader.anonymous_hint,
      viLogin: vi.uploader.login_more,
      enHint: en.uploader.anonymous_hint,
      enLogin: en.uploader.login_more,
    }).toEqual({
      viHint: expect.stringMatching(/1 lượt/i),
      viLogin: expect.stringMatching(/thêm 1 lượt/i),
      enHint: expect.stringMatching(/1 trial scan/i),
      enLogin: expect.stringMatching(/1 additional scan/i),
    });
  });
});
