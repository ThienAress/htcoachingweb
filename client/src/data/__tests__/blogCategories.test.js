import { describe, expect, it } from "vitest";
import {
  BLOG_CATEGORIES,
  BLOG_SUB_CATEGORIES,
  getBlogSubCategoryLabel,
  normalizeBlogSubCategory,
} from "../blogCategories";

describe("blog category configuration", () => {
  it("contains the five agreed topics and all proposed sub-categories", () => {
    expect(BLOG_CATEGORIES.map((category) => category.value)).toEqual([
      "tap-luyen",
      "dinh-duong",
      "hieu-co-the",
      "tu-duy-loi-song",
      "cong-cu-tinh-toan",
    ]);
    expect(
      Object.values(BLOG_SUB_CATEGORIES).flat().map((item) => item.value),
    ).toHaveLength(21);
    expect(BLOG_SUB_CATEGORIES["cong-cu-tinh-toan"]).toHaveLength(4);
  });

  it("keeps the old coaching value compatible with the new expert label", () => {
    expect(normalizeBlogSubCategory("phuong-phap-coaching")).toBe(
      "goc-nhin-chuyen-gia",
    );
    expect(
      getBlogSubCategoryLabel("tu-duy-loi-song", "phuong-phap-coaching"),
    ).toBe("Góc nhìn chuyên gia");
  });
});
