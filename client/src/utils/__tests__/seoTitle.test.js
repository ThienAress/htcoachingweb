import { describe, expect, it } from "vitest";

import { formatSeoTitle } from "../seoTitle.js";

const values = {
  siteName: "HTCOACHING",
  defaultTitle: "HTCOACHING - HLV cá nhân: Gym, Boxing, Tăng cơ & Giảm mỡ",
};

describe("formatSeoTitle", () => {
  it("uses the descriptive default instead of duplicating the brand", () => {
    expect(formatSeoTitle({ ...values, title: "HTCOACHING" })).toBe(
      values.defaultTitle,
    );
  });

  it("adds the brand once to a page title", () => {
    expect(formatSeoTitle({ ...values, title: "Trang chủ" })).toBe(
      "Trang chủ | HTCOACHING",
    );
  });

  it("does not append a second brand to an already formatted title", () => {
    expect(
      formatSeoTitle({ ...values, title: "Bài tập | HTCOACHING" }),
    ).toBe("Bài tập | HTCOACHING");
  });
});
