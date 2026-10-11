import { describe, expect, it } from "vitest";
import {
  foodMatchesMealExclusion,
  foodMatchesMealPhrase,
  parseMealExclusions,
  parseMealRequirements,
} from "../mealConstraints.js";

describe("meal exclusion canonicalization", () => {
  it("canonicalizes Vietnamese phrases without dropping chicken, egg, milk, or whey", () => {
    const exclusions = parseMealExclusions([
      "không ăn thịt gà",
      "không ăn trứng",
      "không thêm sữa hoặc whey",
    ]);

    expect(exclusions.keys).toEqual(["chicken", "egg", "milk"]);
    expect(exclusions.phrases).toEqual(["thit ga", "trung", "sua"]);
  });

  it("matches complete normalized phrases and avoids token-overlap false positives", () => {
    const exclusions = parseMealExclusions(["gà"]);

    expect(foodMatchesMealExclusion({ label: "Ức gà áp chảo" }, exclusions)).toBe(true);
    expect(foodMatchesMealExclusion({ label: "Gạo lứt" }, exclusions)).toBe(false);

    const fish = parseMealExclusions(["cá"]);
    expect(foodMatchesMealExclusion({ label: "Cá hồi áp chảo" }, fish)).toBe(true);
    expect(foodMatchesMealExclusion({ label: "Cà chua" }, fish)).toBe(false);
  });

  it("keeps unknown food phrases instead of silently discarding a constraint", () => {
    const exclusions = parseMealExclusions(["thịt cá ngừ đóng hộp"]);

    expect(exclusions.items).toEqual([
      {
        key: null,
        phrase: "thit ca ngu dong hop",
        aliases: ["thit ca ngu dong hop"],
      },
    ]);
  });

  it("parses required-food clauses without retaining the lead-in", () => {
    expect(parseMealRequirements("với cá, rau củ và đậu phụ").phrases).toEqual([
      "ca",
      "rau cu",
      "dau phu",
    ]);
  });

  it("keeps distinct required foods from the same canonical category", () => {
    expect(parseMealRequirements("cá hồi và cá ngừ").phrases).toEqual([
      "ca hoi",
      "ca ngu",
    ]);
  });

  it("matches required food by the full normalized phrase", () => {
    expect(foodMatchesMealPhrase({ label: "Rau củ hấp" }, "rau củ")).toBe(true);
    expect(foodMatchesMealPhrase({ label: "Bông cải xanh luộc" }, "rau củ")).toBe(false);
    expect(
      foodMatchesMealPhrase(
        { _id: "food-1", label: "Cà chua" },
        { foodId: "food-1", phrase: "cá" },
      ),
    ).toBe(true);
    expect(
      foodMatchesMealPhrase(
        { _id: "food-2", label: "Cá hồi" },
        { foodId: "food-1", phrase: "cá hồi" },
      ),
    ).toBe(false);
  });

  it("does not treat similarly normalized Vietnamese words as the same required food", () => {
    const required = parseMealRequirements("bò").items[0];

    expect(foodMatchesMealPhrase({ label: "Thịt bò nạc" }, required)).toBe(true);
    expect(foodMatchesMealPhrase({ label: "Quả bơ" }, required)).toBe(false);
  });

  it("does not treat similarly normalized Vietnamese words as the same exclusion", () => {
    const exclusions = parseMealExclusions("bò");

    expect(foodMatchesMealExclusion({ label: "Thịt bò nạc" }, exclusions)).toBe(true);
    expect(foodMatchesMealExclusion({ label: "Quả bơ" }, exclusions)).toBe(false);
  });

  it("retains canonical beef meaning after memory normalization removes accents", () => {
    const required = parseMealRequirements("bo").items[0];
    const exclusions = parseMealExclusions("bo");

    expect(required.key).toBe("beef");
    expect(foodMatchesMealPhrase({ label: "Thịt bò nạc" }, required)).toBe(true);
    expect(foodMatchesMealPhrase({ label: "Quả bơ" }, required)).toBe(false);
    expect(foodMatchesMealExclusion({ label: "Thịt bò nạc" }, exclusions)).toBe(true);
    expect(foodMatchesMealExclusion({ label: "Quả bơ" }, exclusions)).toBe(false);
  });

  it("keeps comma-separated exclusion clauses after a lead-in", () => {
    expect(parseMealExclusions("không ăn gà, trứng").phrases).toEqual([
      "ga",
      "trung",
    ]);
  });
});
