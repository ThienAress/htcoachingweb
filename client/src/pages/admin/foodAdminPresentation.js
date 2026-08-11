export const FOOD_ADMIN_TEXT = Object.freeze({
  provenanceLegend: "Nguồn dữ liệu dinh dưỡng",
  legacyWarning:
    "Thực phẩm cũ chưa có nguồn. Cần bổ sung nguồn trước khi sửa chỉ số dinh dưỡng.",
  provider: "Đơn vị cung cấp",
  datasetVersion: "Phiên bản bộ dữ liệu",
  license: "Giấy phép sử dụng",
  attribution: "Thông tin ghi nguồn",
  externalId: "Mã tham chiếu ngoài",
  sourceUrl: "URL nguồn dữ liệu",
  defaultAttribution: "HTCOACHING kiểm duyệt dinh dưỡng thủ công",
  priceLegend: "Giá tham khảo trực tuyến tại TP.HCM (không bắt buộc)",
  noPriceObservation: "Không thêm giá tham khảo",
  priceSavedFirst:
    "Lưu thực phẩm trước, sau đó mở sửa để thêm giá tham khảo.",
});

const FOOD_SOURCE_LABELS = Object.freeze({
  legacy_unknown: "Chưa rõ nguồn",
  manual_verified: "Nhập thủ công đã xác minh",
  nutrition_label: "Nhãn dinh dưỡng",
  usda_fdc: "USDA FoodData Central",
});

export const getFoodSourceLabel = (value) =>
  FOOD_SOURCE_LABELS[value] || "Nguồn khác";
