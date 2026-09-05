import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "vi" },
    t: (key) => ({
      "status.professional_trainer": "Huấn luyện viên chuyên nghiệp",
      "sections.training_style": "Phong cách huấn luyện",
      "sections.achievements": "Thành tích nổi bật",
      "sections.specialties": "Chuyên môn & Dịch vụ",
      "sections.certifications": "Chứng chỉ & Đào tạo",
      "sections.video_intro": "Giới thiệu",
      "sections.video_desc": "Xem video giới thiệu.",
      "sections.methodology": "Phương pháp huấn luyện",
      "sections.methodology_desc": "Mô tả phương pháp",
      "sections.faqs": "Câu hỏi thường gặp",
      "sections.faqs_desc": "Giải đáp thắc mắc",
      "actions.free_consultation": "Đăng ký tư vấn miễn phí",
      "explore.subtitle": "Bắt đầu hành trình",
      "explore.tdee_title": "Tính TDEE & Macro",
      "explore.tdee_desc": "Mô tả TDEE",
      "explore.exercises_title": "Thư viện bài tập",
      "explore.exercises_desc": "Mô tả bài tập",
      "explore.results_title": "Kết quả khách hàng",
      "explore.results_desc": "Mô tả kết quả",
      "detail.aria_prev_image": "Ảnh trước",
      "detail.aria_next_image": "Ảnh tiếp",
    })[key] || key,
  }),
  Trans: ({ children }) => children,
}));

vi.mock("../../components/SEO", () => ({ default: () => null }));
vi.mock("../../components/ScrollToTop", () => ({ default: () => null }));

import TrainerProfile from "../TrainerProfile";

describe("TrainerProfile", () => {
  it("keeps every existing profile section driven by real trainer data", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TrainerProfile
            previewData={{
              _id: "trainer-1",
              slug: "hlv-an",
              name: "Huấn luyện viên An",
              title: "Huấn luyện viên cá nhân",
              headline: "Đồng hành bằng lộ trình phù hợp",
              motto: "Tiến bộ bền vững qua từng buổi tập",
              trainingStyle: "Theo sát kỹ thuật và thói quen",
              images: ["https://example.com/trainer.jpg"],
              stats: [{ label: "Năm kinh nghiệm", value: "8" }],
              achievements: ["Thành tích thật"],
              specialties: [{ icon: "dumbbell", label: "Tăng sức mạnh" }],
              certifications: ["Chứng chỉ thật"],
              videoIntro: "https://example.com/intro.mp4",
              methodologies: [{ title: "Đánh giá", description: "Đo lường trước khi xây lộ trình" }],
              faqs: [{ question: "Tập bao nhiêu buổi?", answer: "Tùy theo mục tiêu và lịch cá nhân." }],
              socialLinks: { facebook: "https://facebook.com/coach-an" },
            }}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    [
      "Huấn luyện viên An",
      "Huấn luyện viên cá nhân",
      "Đồng hành bằng lộ trình phù hợp",
      "Tiến bộ bền vững qua từng buổi tập",
      "Theo sát kỹ thuật và thói quen",
      "Năm kinh nghiệm",
      "Thành tích thật",
      "Tăng sức mạnh",
      "Chứng chỉ thật",
      "Đánh giá",
      "Đo lường trước khi xây lộ trình",
      "Tập bao nhiêu buổi?",
      "Tùy theo mục tiêu và lịch cá nhân.",
      "https://example.com/intro.mp4",
      "https://facebook.com/coach-an",
    ].forEach((content) => expect(html).toContain(content));

    expect(html).not.toMatch(/verified|147 đánh giá|phản hồi trong 2 giờ|cam kết kết quả/i);
  });
});
