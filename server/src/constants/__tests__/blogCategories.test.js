import { describe, expect, it } from "vitest";
import {
  BLOG_CATEGORIES,
  getBlogSubCategoryFilter,
  isBlogCategory,
  isBlogSubCategory,
  normalizeBlogSubCategory,
} from "../blogCategories.js";

describe("blog category rules", () => {
  it("accepts the new tools topic and validates its sub-categories", () => {
    expect(BLOG_CATEGORIES).toHaveLength(5);
    expect(isBlogCategory("cong-cu-tinh-toan")).toBe(true);
    expect(
      isBlogSubCategory("cong-cu-tinh-toan", "huong-dan-tdee"),
    ).toBe(true);
    expect(
      isBlogSubCategory("cong-cu-tinh-toan", "form-ky-thuat"),
    ).toBe(false);
  });

  it("normalizes and queries both the old and new expert-insight values", () => {
    expect(normalizeBlogSubCategory("phuong-phap-coaching")).toBe(
      "goc-nhin-chuyen-gia",
    );
    expect(getBlogSubCategoryFilter("goc-nhin-chuyen-gia")).toEqual({
      $in: ["goc-nhin-chuyen-gia", "phuong-phap-coaching"],
    });
  });
});
