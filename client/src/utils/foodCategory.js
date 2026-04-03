const CATEGORY_KEYWORDS = {
  main_carb: [
    "cơm",
    "gạo trắng",
    "gạo lứt",
    "bún",
    "phở",
    "miến",
    "khoai lang",
    "khoai tây",
  ],

  light_carb: ["bánh mì", "yến mạch", "pasta"],

  fruit: ["chuối", "táo", "cam", "dâu", "bơ trái", "xoài", "mít", "nhãn"],

  animal_protein: [
    "gà",
    "heo",
    "bò",
    "cá",
    "tôm",
    "trứng",
    "vịt",
    "dê",
    "trâu",
    "hươu",
  ],

  dairy_protein: ["sữa chua", "sữa bột", "sữa"],

  supplement_protein: ["whey"],

  plant_protein: ["đậu phụ", "tempeh", "đậu lăng"],

  cooking_fat: ["dầu olive", "dầu dừa", "dầu"],

  whole_food_fat: ["hạt", "đậu phộng", "bơ đậu phộng", "bơ hạnh nhân"],
};

const CATEGORY_PRIORITY = {
  main_carb: 7,
  light_carb: 6,
  fruit: 5,
  animal_protein: 8,
  dairy_protein: 7,
  supplement_protein: 5,
  plant_protein: 6,
  cooking_fat: 10,
  whole_food_fat: 6,
  other: 1,
};

const getPriorityByKeyword = (name, category) => {
  if (category === "main_carb") {
    if (name.includes("cơm")) return 10;
    if (name.includes("gạo lứt")) return 9;
    if (name.includes("bún") || name.includes("phở")) return 9;
    if (name.includes("khoai lang")) return 8;
    return 7;
  }

  if (category === "animal_protein") {
    if (name.includes("trứng")) return 10;
    if (name.includes("gà")) return 10;
    if (name.includes("heo") || name.includes("bò")) return 9;
    if (name.includes("cá") || name.includes("tôm")) return 9;
    if (name.includes("dê") || name.includes("trâu") || name.includes("hươu")) {
      return 8;
    }
    return 8;
  }

  if (category === "dairy_protein") return 7;
  if (category === "supplement_protein") return 5;
  if (category === "plant_protein") return 6;
  if (category === "cooking_fat") return 10;
  if (category === "whole_food_fat") return 6;
  if (category === "fruit") return 5;
  if (category === "light_carb") return 6;

  return CATEGORY_PRIORITY[category] || 1;
};

export const inferCategory = (foodName = "") => {
  const name = foodName.toLowerCase().trim();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const matched = keywords.some((keyword) => name.includes(keyword));
    if (matched) return category;
  }

  return "other";
};

export const getFoodPriority = (foodName = "", category = "") => {
  const name = foodName.toLowerCase().trim();
  return getPriorityByKeyword(name, category);
};

export const enrichFoodDatabase = (foods = []) => {
  return foods.map((food) => {
    const category = inferCategory(food.name);
    const priority = getFoodPriority(food.name, category);

    return {
      ...food,
      category,
      priority,
    };
  });
};
