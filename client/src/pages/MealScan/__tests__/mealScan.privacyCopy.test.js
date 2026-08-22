import { describe, expect, test } from "vitest";

import en from "../../../i18n/locales/en/mealScan.json";
import vi from "../../../i18n/locales/vi/mealScan.json";

describe("Meal Scan photo confirmation copy", () => {
  test("uses HT COACHING branding and plain-language scan usage", () => {
    expect(vi.confirm_analysis.title).toBe("Xác nhận gửi ảnh tới HT COACHING");
    expect(en.confirm_analysis.title).toBe(
      "Confirm sending the photo to HT COACHING",
    );
    expect(vi.confirm_analysis.description).toMatch(/1 lượt phân tích ảnh/i);
    expect(en.confirm_analysis.description).toMatch(/1 photo analysis/i);
    expect(vi.confirm_analysis.description).not.toMatch(/quota/i);
    expect(en.confirm_analysis.description).not.toMatch(/quota/i);
  });

  test("keeps the upload privacy note without provider-specific copy", () => {
    expect(vi.uploader.privacy).not.toMatch(/Google Gemini/i);
    expect(en.uploader.privacy).not.toMatch(/Google Gemini/i);
    expect(vi.why.privacy_desc).not.toMatch(/Google Gemini/i);
    expect(en.why.privacy_desc).not.toMatch(/Google Gemini/i);
    expect(vi.uploader.privacy).toMatch(/không lưu ảnh vào hồ sơ/i);
    expect(en.uploader.privacy).toMatch(/does not save the photo/i);
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
