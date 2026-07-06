// Suggest Meal Tool — Gợi ý thực đơn từ Food database
import Food from "../../../models/Food.js";

/**
 * Gợi ý thực đơn dựa trên macro mục tiêu
 * @param {{ targetCalories, proteinGrams, carbGrams, fatGrams, mealsPerDay? }} params
 * @returns {{ text: string, uiCard: null }}
 */
export async function suggestMeal(params) {
  const { targetCalories, proteinGrams, carbGrams, fatGrams, mealsPerDay = 3 } = params;

  // Lấy thực phẩm từ DB
  const proteinFoods = await Food.find({ protein: { $gte: 12 } }).lean();
  const carbFoods = await Food.find({ carb: { $gte: 15 } }).lean();
  const fatFoods = await Food.find({ fat: { $gte: 8 } }).lean();

  // Fallback data nếu DB trống
  const proteinList = proteinFoods.length > 0 ? proteinFoods : [
    { label: "Ức gà áp chảo", protein: 22, carb: 0, fat: 2.5, calories: 120 },
    { label: "Thịt bò nạc", protein: 26, carb: 0, fat: 5, calories: 150 },
    { label: "Cá hồi áp chảo", protein: 20, carb: 0, fat: 13, calories: 200 },
    { label: "Trứng gà luộc", protein: 13, carb: 1, fat: 10, calories: 155 },
    { label: "Tôm hấp", protein: 24, carb: 0, fat: 0.8, calories: 99 },
  ];

  const carbList = carbFoods.length > 0 ? carbFoods : [
    { label: "Khoai lang luộc", protein: 1.6, carb: 20, fat: 0.1, calories: 86 },
    { label: "Cơm lứt", protein: 2.6, carb: 23, fat: 0.9, calories: 110 },
    { label: "Yến mạch luộc", protein: 13.5, carb: 56, fat: 7, calories: 379 },
    { label: "Bánh mì đen", protein: 9, carb: 48, fat: 1.5, calories: 250 },
    { label: "Bông cải xanh luộc", protein: 3, carb: 7, fat: 0, calories: 34 },
  ];

  const fatList = fatFoods.length > 0 ? fatFoods : [
    { label: "Hạnh nhân", protein: 21, carb: 22, fat: 49, calories: 579 },
    { label: "Hạt điều", protein: 18, carb: 30, fat: 44, calories: 553 },
    { label: "Quả bơ", protein: 2, carb: 9, fat: 15, calories: 160 },
    { label: "Dầu ô liu", protein: 0, carb: 0, fat: 100, calories: 884 },
  ];

  // Helper xáo trộn thực phẩm để đa dạng thực đơn qua các bữa
  const shuffleArray = (array) => [...array].sort(() => Math.random() - 0.5);
  const shuffledProteins = shuffleArray(proteinList);
  const shuffledCarbs = shuffleArray(carbList);
  const shuffledFats = shuffleArray(fatList);

  const perMealP = Math.round(proteinGrams / mealsPerDay);
  const perMealC = Math.round(carbGrams / mealsPerDay);
  const perMealF = Math.round(fatGrams / mealsPerDay);

  let responseText = `# THỰC ĐƠN GỢI Ý (${mealsPerDay} BỮA/NGÀY)\n`;
  responseText += `Mục tiêu calo: **${targetCalories} kcal/ngày**\n`;
  responseText += `Phân bổ Macro: **${proteinGrams}g Protein | ${carbGrams}g Carb | ${fatGrams}g Fat**\n\n`;

  for (let i = 0; i < mealsPerDay; i++) {
    const mealLabel = getMealLabel(i, mealsPerDay);
    responseText += `### ${mealLabel}\n`;

    const pFood = shuffledProteins[i % shuffledProteins.length];
    const cFood = shuffledCarbs[i % shuffledCarbs.length];
    const fFood = shuffledFats[i % shuffledFats.length];

    // 1. Tính toán lượng Protein chính (gánh khoảng 85% protein bữa đó)
    let weightP = Math.round(((perMealP * 0.85) / pFood.protein) * 100);
    weightP = Math.max(50, Math.min(250, Math.round(weightP / 10) * 10));

    const actP_P = Math.round((pFood.protein * weightP) / 100);
    const actC_P = Math.round((pFood.carb * weightP) / 100);
    const actF_P = Math.round((pFood.fat * weightP) / 100);
    responseText += `- **${weightP}g ${pFood.label}** (${actP_P}g P, ${actC_P}g C, ${actF_P}g F)\n`;

    // 2. Tính toán lượng Carb chính (bù đắp phần carb còn thiếu)
    let weightC = 0;
    if (perMealC > 5) {
      const cNeeded = perMealC - actC_P;
      weightC = Math.round((Math.max(5, cNeeded) / cFood.carb) * 100);
      weightC = Math.max(30, Math.min(300, Math.round(weightC / 10) * 10));

      const actP_C = Math.round((cFood.protein * weightC) / 100);
      const actC_C = Math.round((cFood.carb * weightC) / 100);
      const actF_C = Math.round((cFood.fat * weightC) / 100);
      responseText += `- **${weightC}g ${cFood.label}** (${actP_C}g P, ${actC_C}g C, ${actF_C}g F)\n`;
    }

    // 3. Tính toán lượng Fat chính (bù đắp phần fat còn thiếu)
    let weightF = 0;
    if (perMealF > 3) {
      const fNeeded = perMealF - actF_P;
      if (fNeeded > 1) {
        weightF = Math.round((fNeeded / fFood.fat) * 100);
        weightF = Math.max(10, Math.min(80, Math.round(weightF / 5) * 5));

        const actP_F = Math.round((fFood.protein * weightF) / 100);
        const actC_F = Math.round((fFood.carb * weightF) / 100);
        const actF_F = Math.round((fFood.fat * weightF) / 100);
        responseText += `- **${weightF}g ${fFood.label}** (${actP_F}g P, ${actC_F}g C, ${actF_F}g F)\n`;
      }
    }

    responseText += `\n`;
  }

  responseText += `### MỘT VÀI LƯU Ý "TRY HARD" CHO BẠN:\n`;
  responseText += `1. **Gia vị:** Hạn chế đường, sốt mayonnaise, tương cà. Ưu tiên muối, tiêu, ớt, tỏi, chanh để giữ hương vị mà không thêm calo rỗng.\n`;
  responseText += `2. **Chế biến:** Ưu tiên hấp, luộc, áp chảo, nướng. Tránh chiên ngập dầu.\n`;
  responseText += `3. **Linh hoạt:** Nếu thấy quá ngán, bạn có thể đổi ${proteinList[0].label.toLowerCase()} lấy ức gà tây, cá hồi lấy cá thu hoặc tôm, miễn là giữ được lượng Protein và kiểm soát Carb.\n`;
  responseText += `4. **Theo dõi:** Hãy lắng nghe cơ thể. Nếu cảm thấy quá đuối trong buổi tập, hãy tăng nhẹ lượng Carb vào bữa trước khi tập.\n`;

  return { text: responseText, uiCard: null };
}

function getMealLabel(index, total) {
  if (total <= 3) return ["Bữa sáng", "Bữa trưa", "Bữa tối"][index] || `Bữa ${index + 1}`;
  if (total === 4) return ["Bữa sáng", "Bữa trưa", "Bữa phụ chiều (Trước tập)", "Bữa tối"][index];
  if (total === 5) return ["Bữa sáng", "Bữa phụ sáng", "Bữa trưa", "Bữa phụ chiều", "Bữa tối"][index];
  return `Bữa ${index + 1}`;
}
