// utils/mealdbAdapter.js
// Adapter để normalize data từ TheMealDB API về chuẩn Recipe format

/**
 * Chuẩn hóa raw meal data từ TheMealDB thành format Recipe
 * TheMealDB trả về strIngredient1..20 (flat map) → parse thành array
 */
export const normalizeMealDbMeal = (rawMeal) => {
  if (!rawMeal) return null;

  // Parse ingredients từ flat map strIngredient1..20
  const ingredients = [];
  for (let i = 1; i <= 20; i++) {
    const name = rawMeal[`strIngredient${i}`];
    const measure = rawMeal[`strMeasure${i}`];

    if (name && name.trim()) {
      ingredients.push({
        name: name.trim(),
        measure: measure ? measure.trim() : "",
      });
    }
  }

  // Parse instructions: split bằng \r\n hoặc \n, lọc dòng trống
  const rawInstructions = rawMeal.strInstructions || "";
  const instructions = rawInstructions
    .split(/\r?\n/)
    .map((step) => step.trim())
    .filter((step) => step.length > 0);

  return {
    name: rawMeal.strMeal || "",
    nameEn: rawMeal.strMeal || "",
    category: rawMeal.strCategory || "",
    area: rawMeal.strArea || "",
    thumbnail: rawMeal.strMealThumb || "",
    ingredients,
    instructions,
    youtubeUrl: rawMeal.strYoutube || "",
    sourceUrl: rawMeal.strSource || "",
    source: "mealdb",
    mealDbId: rawMeal.idMeal || "",
  };
};

/**
 * Tạo slug từ tên món ăn
 * "Gà Kho Sả Ớt" → "ga-kho-sa-ot"
 */
export const createSlug = (name) => {
  if (!name) return "";

  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Bỏ dấu tiếng Việt
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .replace(/[^a-z0-9\s-]/g, "") // Chỉ giữ chữ, số, dấu cách, gạch ngang
    .replace(/\s+/g, "-") // Dấu cách → gạch ngang
    .replace(/-+/g, "-") // Nhiều gạch ngang → 1
    .replace(/^-|-$/g, ""); // Bỏ gạch ngang đầu/cuối
};
