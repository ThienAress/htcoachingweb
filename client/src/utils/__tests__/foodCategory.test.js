import { describe, it, expect } from "vitest";
import {
  inferCategory,
  getFoodPriority,
  enrichFoodDatabase,
} from "../foodCategory";

// =============================================================================
// TDD: foodCategory.js — Logic phân loại thực phẩm cho meal plan generator
// Business logic: ảnh hưởng trực tiếp đến kết quả meal plan của khách hàng
// =============================================================================

describe("inferCategory", () => {
  // --- Carbs ---
  it('phân loại "cơm trắng" vào main_carb', () => {
    expect(inferCategory("Cơm trắng")).toBe("main_carb");
  });

  it('phân loại "gạo lứt" vào main_carb', () => {
    expect(inferCategory("Gạo lứt")).toBe("main_carb");
  });

  it('phân loại "khoai lang" vào main_carb', () => {
    expect(inferCategory("Khoai lang nướng")).toBe("main_carb");
  });

  it('phân loại "bánh mì" vào light_carb', () => {
    expect(inferCategory("Bánh mì đen")).toBe("light_carb");
  });

  it('phân loại "yến mạch" vào light_carb', () => {
    expect(inferCategory("Yến mạch nguyên hạt")).toBe("light_carb");
  });

  // --- Protein ---
  it('phân loại "ức gà" vào animal_protein', () => {
    expect(inferCategory("Ức gà nướng")).toBe("animal_protein");
  });

  it('phân loại "trứng" vào animal_protein', () => {
    expect(inferCategory("Trứng gà luộc")).toBe("animal_protein");
  });

  it('phân loại "cá hồi" vào animal_protein', () => {
    expect(inferCategory("Cá hồi áp chảo")).toBe("animal_protein");
  });

  it('phân loại "whey" vào supplement_protein', () => {
    expect(inferCategory("Whey protein")).toBe("supplement_protein");
  });

  it('phân loại "đậu phụ" vào plant_protein', () => {
    expect(inferCategory("Đậu phụ chiên")).toBe("plant_protein");
  });

  it('phân loại "sữa chua" vào dairy_protein', () => {
    expect(inferCategory("Sữa chua Hy Lạp")).toBe("dairy_protein");
  });

  // --- Fat ---
  it('phân loại "dầu olive" vào cooking_fat', () => {
    expect(inferCategory("Dầu olive")).toBe("cooking_fat");
  });

  it('phân loại "bơ đậu phộng" vào whole_food_fat', () => {
    expect(inferCategory("Bơ đậu phộng")).toBe("whole_food_fat");
  });

  // --- Fruit ---
  it('phân loại "chuối" vào fruit', () => {
    expect(inferCategory("Chuối")).toBe("fruit");
  });

  // --- Edge cases ---
  it('trả về "other" cho thực phẩm không nhận diện được', () => {
    expect(inferCategory("Rau cải xanh")).toBe("other");
  });

  it('trả về "other" cho input rỗng', () => {
    expect(inferCategory("")).toBe("other");
  });

  it('trả về "other" khi không truyền tham số', () => {
    expect(inferCategory()).toBe("other");
  });

  it("case-insensitive: xử lý viết hoa viết thường", () => {
    expect(inferCategory("CƠM TRẮNG")).toBe("main_carb");
    expect(inferCategory("ức GÀ")).toBe("animal_protein");
  });
});

describe("getFoodPriority", () => {
  it("cơm có priority 10 (cao nhất trong main_carb)", () => {
    expect(getFoodPriority("Cơm trắng", "main_carb")).toBe(10);
  });

  it("gạo lứt có priority 9", () => {
    expect(getFoodPriority("Gạo lứt", "main_carb")).toBe(9);
  });

  it("trứng có priority 10 (cao nhất trong animal_protein)", () => {
    expect(getFoodPriority("Trứng gà", "animal_protein")).toBe(10);
  });

  it("gà có priority 10", () => {
    expect(getFoodPriority("Ức gà", "animal_protein")).toBe(10);
  });

  it("cooking_fat luôn trả về 10", () => {
    expect(getFoodPriority("Dầu olive", "cooking_fat")).toBe(10);
  });

  it("category không xác định trả về 1", () => {
    expect(getFoodPriority("Rau cải", "unknown")).toBe(1);
  });
});

describe("enrichFoodDatabase", () => {
  it("thêm category + priority vào mỗi food item", () => {
    const foods = [
      { name: "Cơm trắng", calories: 130 },
      { name: "Ức gà", calories: 165 },
    ];
    const result = enrichFoodDatabase(foods);

    expect(result[0].category).toBe("main_carb");
    expect(result[0].priority).toBe(10);
    expect(result[0].calories).toBe(130); // giữ nguyên fields gốc

    expect(result[1].category).toBe("animal_protein");
    expect(result[1].priority).toBe(10);
  });

  it("trả về array rỗng khi input rỗng", () => {
    expect(enrichFoodDatabase([])).toEqual([]);
  });

  it("trả về array rỗng khi không truyền tham số", () => {
    expect(enrichFoodDatabase()).toEqual([]);
  });

  it("không mutate array gốc", () => {
    const foods = [{ name: "Cơm trắng", calories: 130 }];
    const result = enrichFoodDatabase(foods);

    // result phải là array mới, không phải foods
    expect(result).not.toBe(foods);
    // food item gốc không bị thêm fields
    expect(foods[0].category).toBeUndefined();
  });
});
