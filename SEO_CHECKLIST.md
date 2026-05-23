# Checklist 20 đầu mục cải thiện SEO cho website React

Tài liệu này dùng để theo dõi quá trình tối ưu hóa SEO cho dự án **htcoachingweb** (React SPA).

## Nguyên tắc chung
- **Ưu tiên:** P0 (Cần làm ngay) -> P1 (Cần làm sau).
- **Trọng tâm:** Route public phải có metadata, nội dung chính, link nội bộ và dữ liệu cấu trúc rõ ràng.
- **Kỹ thuật:** Kết hợp prerender/SSR từng phần cho các URL quan trọng.

---

| STT | Đầu mục | Ưu tiên | Việc cần làm | Cách triển khai / Tiêu chí hoàn thành | Trạng thái |
|:---:|:---|:---:|:---|:---|:---:|
| 1 | **Audit SEO hiện trạng** | P0 | Lập danh sách route public, kiểm tra HTML ban đầu (view-source). | Tạo sheet audit (URL, title, desc, H1, sitemap...). Ưu tiên 20-50 URL quan trọng. | ✅ |
| 2 | **Tối ưu rendering** | P0 | Giảm tình trạng HTML rỗng. Route SEO cần có nội dung ngay từ đầu. | Dùng prerender/SSR từng phần cho trang chủ, dịch vụ, sản phẩm, blog. | ✅ |
| 3 | **Cài hệ thống metadata** | P0 | Component SEO dùng chung cho title, desc, OG, Twitter Card. | Cài `react-helmet-async`. Bọc app bằng `HelmetProvider`. | ✅ |
| 4 | **Title riêng từng page** | P0 | Mỗi URL indexable phải có title riêng biệt + brand. | Ví dụ: "Dịch vụ | Brand". Tránh dùng title chung cho toàn web. | ✅ |
| 5 | **Meta description riêng** | P0 | Viết description riêng, tóm tắt đúng nội dung từng page. | Tăng CTR bằng cách mô tả giá trị thực tế của trang. | ✅ |
| 6 | **Canonical URL** | P0 | Gắn canonical absolute URL để tránh trùng lặp content. | Tránh lỗi query parameters, UTM, slash, www/non-www. | ✅ |
| 7 | **Sitemap XML tự động** | P0 | Tạo `/sitemap.xml` tự động chứa các URL 200, indexable. | Script Node chạy ở prebuild để lấy dữ liệu từ API/CMS. | ✅ |
| 8 | **Robots.txt đúng chuẩn** | P0 | Hướng dẫn crawler các vùng được phép và không được phép. | Allow public, Disallow `/admin`, `/account`, `/cart`... | ✅ |
| 9 | **Noindex page không SEO** | P0 | Loại bỏ các trang nhạy cảm hoặc mỏng khỏi Google index. | Gắn `<meta name="robots" content="noindex,nofollow">` cho login, cart... | ✅ |
| 10 | **URL structure sạch** | P0 | Dùng URL readable, lowercase, gạch ngang. Không dùng hash route. | Ví dụ: `/blog/toi-uu-seo-react` thay vì `/index.html#blog`. | ✅ |
| 11 | **HTTP status & redirect** | P0 | Trả đúng status code (200, 404, 301). | Redirect HTTPS, non-www -> www (hoặc ngược lại). | ✅ |
| 12 | **Structured Data (JSON-LD)** | P1 | Thêm schema: Organization, Product, Article, FAQ... | Render `<script type="application/ld+json">` cho từng loại page. | ✅ |
| 13 | **Semantic HTML & Heading** | P1 | Dùng tag có nghĩa (main, section, article). Phân cấp H1-H3. | 1 H1 duy nhất mỗi trang. Nội dung quan trọng phải là text. | ✅ |
| 14 | **Internal linking** | P1 | Xây dựng mạng lưới link nội bộ (header, footer, breadcrumb). | Dùng `<a href="...">` thay vì `onClick` để bot có thể crawl. | ✅ |
| 15 | **Image SEO** | P1 | Tối ưu Alt text, định dạng (WebP), lazy load, width/height. | Không lazy-load ảnh Hero (LCP). Giảm Layout Shift. | ✅ |
| 16 | **Core Web Vitals** | P1 | Tối ưu LCP, INP, CLS. | Cải thiện tốc độ tải và độ ổn định giao diện. | ✅ |
| 17 | **Giảm JS bundle** | P1 | Code splitting, lazy loading components. | Dùng `React.lazy`. Giảm thư viện nặng không cần thiết. | ✅ |
| 18 | **Mobile & Accessibility** | P1 | Đảm bảo responsive, text đủ lớn, tương tác tốt trên mobile. | Không popup che màn hình. Cung cấp aria-label cho icon. | ✅ |
| 19 | **Template SEO** | P1 | Chuẩn hóa template cho từng loại page (Blog, Product...). | Đội dev/content triển khai nhất quán dựa trên template. | ✅ |
| 20 | **Đo lường & Monitoring** | P0/P1 | Theo dõi Search Console, Google Analytics, Lighthouse. | Theo dõi index, clicks và Core Web Vitals sau deploy. | ✅ |

---

## Ghi chú triển khai
- Bắt đầu với **P0** để xử lý các vấn đề nền tảng trước.
- Với React SPA, mục số **2 (Prerendering)** là quan trọng nhất để Bot thấy được nội dung.
