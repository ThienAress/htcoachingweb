import api from "../utils/api";

export const analyzeMeal = async (
  image,
  locale = "vi",
  declaredIngredients = [],
  providerDataUseAccepted = false,
) => {
  if (providerDataUseAccepted !== true) {
    throw Object.assign(
      new Error("Bạn cần đồng ý gửi ảnh tới nhà cung cấp AI trước khi phân tích"),
      { code: "MEAL_SCAN_CONSENT_REQUIRED" },
    );
  }
  const response = await api.post("/meal-scans/analyze", {
    image,
    locale: locale === "en" ? "en" : "vi",
    declaredIngredients,
    providerDataUseAccepted,
  });

  if (!response.data?.success || !response.data?.data) {
    throw new Error("Kết quả phân tích không hợp lệ");
  }
  return {
    result: response.data.data,
    quota: response.data.meta?.quota || null,
  };
};
