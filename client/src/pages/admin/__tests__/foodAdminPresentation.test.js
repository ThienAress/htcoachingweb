import { describe, expect, it } from "vitest";

import {
  FOOD_ADMIN_TEXT,
  getFoodSourceLabel,
} from "../foodAdminPresentation";

describe("Food Admin presentation", () => {
  it("dùng copy tiếng Việt thay cho thuật ngữ kỹ thuật tiếng Anh trong modal", () => {
    expect(FOOD_ADMIN_TEXT).toEqual({
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
  });

  it("không hiển thị raw enum nguồn dữ liệu cho admin", () => {
    expect([
      getFoodSourceLabel("legacy_unknown"),
      getFoodSourceLabel("manual_verified"),
      getFoodSourceLabel("nutrition_label"),
      getFoodSourceLabel("usda_fdc"),
      getFoodSourceLabel("unexpected"),
    ]).toEqual([
      "Chưa rõ nguồn",
      "Nhập thủ công đã xác minh",
      "Nhãn dinh dưỡng",
      "USDA FoodData Central",
      "Nguồn khác",
    ]);
  });
});
