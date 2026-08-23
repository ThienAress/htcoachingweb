import { describe, expect, it } from "vitest";

import { notificationMissingFieldsLabel } from "../notificationMissingFields";

describe("notificationMissingFieldsLabel", () => {
  it("translates only supported field keys into a Vietnamese summary", () => {
    expect(
      notificationMissingFieldsLabel([
        "energy",
        "unknownField",
        "pain",
      ]),
    ).toBe("Chưa nhập: Năng lượng, Mức đau");
  });

  it("returns an empty label for old notifications", () => {
    expect(notificationMissingFieldsLabel()).toBe("");
  });
});
