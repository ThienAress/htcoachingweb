import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) => ({
      "actions.view_journey": "Xem hành trình",
      "customer_card.before": "Trước",
      "customer_card.after": "Sau",
      "customer_card.age_suffix": "tuổi",
      "customer_card.duration_label": "Hành trình",
      "detail.aria_prev_image": "Ảnh trước",
      "detail.aria_next_image": "Ảnh tiếp",
    })[key] || key,
  }),
}));

import CustomerStoryCard from "../CustomerStoryCard";
import TrainerGallery from "../TrainerGallery";
import TrainerSocialLinks from "../TrainerSocialLinks";

describe("Trainer profile presentation", () => {
  it("keeps the card concise and leads with journey duration before name and age", () => {
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
    expect(html).toContain('aria-label="Xem hành trình: Khách hàng An"');
    expect(html).toContain('alt="Khách hàng An - Trước"');
    expect(html).toContain('alt="Khách hàng An - Sau"');
    expect(html.indexOf("Hành trình 12 tuần")).toBeLessThan(
      html.indexOf("Khách hàng An</span>"),
    );
    expect(html).toContain("items-center");
    expect(html).toContain("data-story-divider");
    expect(html).toContain("clip-path:polygon(52.34%_0,52.54%_0,42.1%_100%,41.9%_100%)");
    expect(html).toContain("28 tuổi");
    expect(html).not.toContain("Hoàn thành mục tiêu đã đặt ra");
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
