export const FOOD_ADMIN_TEXT = Object.freeze({
  defaultAttribution: "HTCOACHING kiểm duyệt dinh dưỡng thủ công",
  priceLegend: "Giá tham khảo trực tuyến tại TP.HCM (không bắt buộc)",
  noPriceObservation: "Không thêm giá tham khảo",
  priceSavedFirst:
    "Lưu thực phẩm trước, sau đó mở sửa để thêm giá tham khảo.",
});

export const createAdminVerifiedFoodSource = (verifiedAt = new Date()) => {
  const isoDate = verifiedAt.toISOString();
  return {
    type: "manual_verified",
    provider: "HTCOACHING",
    datasetVersion: `admin-manual-${isoDate.slice(0, 7)}`,
    license: "proprietary-internal",
    attribution: FOOD_ADMIN_TEXT.defaultAttribution,
    verifiedAt: isoDate,
  };
};
