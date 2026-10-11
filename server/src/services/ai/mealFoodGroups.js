const normalize = (value) =>
  String(value || "").normalize("NFC").toLocaleLowerCase("vi").trim();

const hasAny = (name, keywords) => keywords.some((keyword) => name.includes(keyword));

// Foods that are never a sensible "sample menu" building block.
const EXCLUDED_KEYWORDS = Object.freeze([
  "mật ong", "đường", "kẹo", "bánh ngọt", "mứt", "siro", "xi rô", "nước ngọt",
  "bia", "rượu", "whey", "protein bột", "bột protein", "bơ thực vật", "margarin",
  "mỡ", "mayonnaise", "tương", "nước mắm", "mắm", "muối", "khô", "tiết", "lòng",
  "óc bò", "óc lợn", "dạ dày", "phổi", "bầu dục", "gan", "chó", "ngựa", "sữa mẹ",
  "sữa đặc", "sô cô la", "chocolate", "kem", "xúc xích", "giò", "chả", "lạp xưởng",
  "pate", "patê", "đồ hộp", "hộp", "mì chính", "bột ngọt", "dầu dừa", "dầu cọ",
  "nhộng", "châu chấu", "rươi", "rạm", "bì lợn", "bột", "nước dùng", "súp",
]);

const STARCH_KEYWORDS = Object.freeze([
  "cơm", "gạo", "phở", "bún", "miến", "bánh canh", "hủ tiếu", "hủ tíu", "mì ",
  "mỳ", "nui", "bánh mì", "yến mạch", "khoai lang", "khoai tây",
]);

const PROTEIN_KEYWORDS = Object.freeze([
  "thịt", "ức gà", "gà", "bò", "heo", "lợn", "vịt", "cá", "tôm", "mực", "trứng",
  "đậu phụ", "đậu hũ", "cua", "nghêu", "ngao", "sò", "tép",
]);

const DAIRY_KEYWORDS = Object.freeze(["sữa tươi", "sữa chua", "sữa"]);

const FAT_KEYWORDS = Object.freeze([
  "ô liu", "olive", "hạnh nhân", "óc chó", "mắc ca", "hạt điều", "hạt", "đậu phộng",
  "lạc", "vừng", "mè", "dầu lạc", "dầu hạt cải", "canola", "hướng dương", "dầu đậu nành",
]);

const isAvocado = (name, food) =>
  (name === "bơ" || name.includes("quả bơ") || name.includes("bơ trái") || name.includes("bơ (")) &&
  Number(food.fat) < 30;

export const MEAL_FOOD_GROUPS = Object.freeze(["protein", "starch", "fat"]);

/**
 * Classifies a catalog food into the three sample-menu groups the product owner
 * asked for: starch (rice, pho, bun, mien...), protein (meat, fish, egg, milk,
 * shrimp, squid...) and healthy fats (avocado, nuts, olive oil...).
 * Returns null for foods that should not appear in a sample menu.
 */
export const classifyMealFood = (food) => {
  const name = normalize(food?.label);
  if (!name || hasAny(name, EXCLUDED_KEYWORDS)) return null;
  const protein = Number(food.protein) || 0;
  const carb = Number(food.carb) || 0;
  const fat = Number(food.fat) || 0;
  if (hasAny(` ${name} `, STARCH_KEYWORDS) && carb >= 12 && fat < 20) return "starch";
  if (hasAny(name, DAIRY_KEYWORDS) && protein >= 3 && fat < 12) return "protein";
  if (hasAny(name, PROTEIN_KEYWORDS) && protein >= 8 && carb < 20) return "protein";
  if ((isAvocado(name, food) || hasAny(name, FAT_KEYWORDS)) && fat >= 10) return "fat";
  return null;
};

export const groupMealFoods = (foods) => {
  const groups = { protein: [], starch: [], fat: [] };
  for (const food of foods) {
    const group = classifyMealFood(food);
    if (group) groups[group].push(food);
  }
  return groups;
};
