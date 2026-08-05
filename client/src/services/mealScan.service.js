import api from "../utils/api";

export const analyzeMeal = async (
  image,
  locale = "vi",
  declaredIngredients = [],
) => {
  const response = await api.post("/meal-scans/analyze", {
    image,
    locale: locale === "en" ? "en" : "vi",
    declaredIngredients,
  });

  if (!response.data?.success || !response.data?.data) {
    throw new Error("Kết quả phân tích không hợp lệ");
  }
  return response.data.data;
};
