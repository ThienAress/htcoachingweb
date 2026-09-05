import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) => ({
      "actions.detail_view": "Xem chi tiết",
      "customer_card.before": "Trước",
      "customer_card.after": "Sau",
      "customer_card.age_suffix": "tuổi",
      "customer_card.duration_label": "Thời gian tập luyện",
      "detail.aria_prev_image": "Ảnh trước",
      "detail.aria_next_image": "Ảnh tiếp",
    })[key] || key,
  }),
}));

import CustomerStoryCard from "../CustomerStoryCard";
import TrainerGallery from "../TrainerGallery";
import TrainerSocialLinks from "../TrainerSocialLinks";

describe("Trainer profile presentation", () => {
  it("renders only factual customer-story fields with a directly accessible detail link", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <CustomerStoryCard
          story={{
            slug: "hanh-trinh-cua-an",
            name: "Khách hàng An",
            age: 28,
            result: "Hoàn thành mục tiêu đã đặt ra",
            duration: "12 tuần",
            beforeImg: ["https://example.com/before.jpg"],
            afterImg: "https://example.com/after.jpg",
          }}
        />
      </MemoryRouter>,
    );

    expect(html).toContain('href="/ket-qua-khach-hang/hanh-trinh-cua-an/"');
    expect(html).toContain('aria-label="Xem chi tiết: Khách hàng An"');
    expect(html).toContain('alt="Khách hàng An - Trước"');
    expect(html).toContain('alt="Khách hàng An - Sau"');
    expect(html).toContain("Hoàn thành mục tiêu đã đặt ra");
    expect(html).not.toMatch(/verified|đánh giá|cam kết kết quả|phản hồi trong/i);
  });

  it("keeps every trainer image reachable through labelled gallery controls", () => {
    const html = renderToStaticMarkup(
      <TrainerGallery
        name="Huấn luyện viên An"
        images={["https://example.com/one.jpg", "https://example.com/two.jpg"]}
      />,
    );

    expect(html).toContain('aria-label="Ảnh trước: Huấn luyện viên An"');
    expect(html).toContain('aria-label="Ảnh tiếp: Huấn luyện viên An"');
    expect(html).toContain('aria-label="Huấn luyện viên An: 1"');
    expect(html).toContain('aria-label="Huấn luyện viên An: 2"');
  });

  it("normalizes an existing Zalo number without inventing missing social links", () => {
    const html = renderToStaticMarkup(
      <TrainerSocialLinks socialLinks={{ zalo: "0909000000", facebook: "https://facebook.com/coach" }} />,
    );

    expect(html).toContain('href="https://zalo.me/0909000000"');
    expect(html).toContain('href="https://facebook.com/coach"');
    expect(html).not.toContain("Instagram");
    expect(html).not.toContain("TikTok");
  });
});
