---
paths:
  - "client/src/pages/**"
  - "client/src/sections/**"
  - "client/src/seo/**"
  - "client/src/components/SEO.jsx"
  - "client/src/App.jsx"
  - "client/scripts/**"
  - "client/public/**"
  - "client/index.html"
---

# SEO rules — HTCOACHINGWEB

## Hệ thống ba lớp

1. `client/index.html`: meta mặc định.
2. `<SEO>` (`client/src/components/SEO.jsx`, react-helmet-async): override theo page.
3. Build lifecycle (`npm run build --prefix client`): `prebuild` chạy `client/scripts/generate-sitemap.js`
   (static `staticRoutes` + route động lấy từ API) và ghi manifest `client/scripts/.generated/prerender-routes.json`;
   `postbuild` chạy `client/scripts/prerender.js` đọc manifest đó, rồi kiểm bundle budget và search index.

Route public mới: thêm vào `staticRoutes` trong `generate-sitemap.js` (prerender lấy từ manifest, không sửa danh
sách trong `prerender.js`). Content type động mới: mở rộng logic route động và test trong `client/scripts/__tests__/`.

## Bắt buộc với page public

- Có `<SEO>` với `title`, `description` (150–160 ký tự, có CTA), `canonical` là path tương đối bắt đầu `/`
  (component tự gắn domain `https://htcoachingweb.io.vn`). Tùy chọn: `type`, `image` (OG 1200×630 tuyệt đối), `jsonLd`.
- Trang hệ thống (login, admin, trainer, account, wallet, checkin...) đặt `noindex={true}`.
- Slug kebab-case tiếng Việt không dấu: `/ket-qua-khach-hang`, `/huan-luyen-vien/{slug}`.
- Mỗi page một canonical; trang phân trang dùng list page làm canonical.
- Không tạo orphan page: thêm internal link tự nhiên tới ít nhất hai page public liên quan
  (TDEE, Exercises, Kết quả khách hàng, Meal Plan, Blog...).
- Page quan trọng (công cụ, dịch vụ, landing) thêm một dòng vào `client/public/llms.txt`.

## JSON-LD

| Trang | Schema |
|---|---|
| Home | `@graph` gồm Organization + ProfessionalService + Service + FAQPage; nguồn canonical là `homeSchema` trong `client/src/pages/Home.jsx`. Không thay bằng `LocalBusiness` khi chưa có địa điểm canonical đã xác minh. |
| Customer story | Article (`headline`, `image`, `datePublished`, `dateModified`, author Organization) + BreadcrumbList |
| Trainer profile | Person (+ FAQPage trong `@graph` nếu có Q&A) + BreadcrumbList |
| Công cụ (TDEE, Exercises...) | WebApplication + FAQPage trong `@graph` |
| Pricing | Service + Offer (`priceCurrency: VND`) |

Trang có URL lồng nhau dùng BreadcrumbList. Khi sửa schema, kiểm DOM sau prerender/render (`script[type="application/ld+json"]`),
không chỉ source JSX. Quét/kiểm toàn bộ SEO dùng skill `seo`.
