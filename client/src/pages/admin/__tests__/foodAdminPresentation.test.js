import { describe, expect, it } from "vitest";

import {
  createAdminVerifiedFoodSource,
  FOOD_ADMIN_TEXT,
} from "../foodAdminPresentation";

describe("Food Admin presentation", () => {
  it("dùng copy tiếng Việt thay cho thuật ngữ kỹ thuật tiếng Anh trong modal", () => {
    expect(FOOD_ADMIN_TEXT).toEqual({
      defaultAttribution: "HTCOACHING kiểm duyệt dinh dưỡng thủ công",
      priceLegend: "Giá tham khảo trực tuyến tại TP.HCM (không bắt buộc)",
      noPriceObservation: "Không thêm giá tham khảo",
      priceSavedFirst:
        "Lưu thực phẩm trước, sau đó mở sửa để thêm giá tham khảo.",
    });
  });

  it("tự tạo metadata xác minh nội bộ khi Admin lưu thực phẩm", () => {
    const source = createAdminVerifiedFoodSource(
      new Date("2026-08-27T05:30:00.000Z"),
    );

    expect(source).toEqual({
      type: "manual_verified",
      provider: "HTCOACHING",
      datasetVersion: "admin-manual-2026-08",
      license: "proprietary-internal",
      attribution: "HTCOACHING kiểm duyệt dinh dưỡng thủ công",
      verifiedAt: "2026-08-27T05:30:00.000Z",
    });
  });
});
