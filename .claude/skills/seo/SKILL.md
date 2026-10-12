---
name: seo
description: Thêm trang public mới cần Google index (route lazy, SEO component, JSON-LD, sitemap/prerender, internal links, llms.txt) hoặc quét SEO toàn bộ trang public của HTCOACHINGWEB ở mode static/rendered/live. Dùng khi tạo/sửa page public, đổi metadata, sitemap, prerender hoặc trước release.
argument-hint: "[new <TênPage> <route>] | [check static|rendered|live]"
---

# SEO — trang public HTCOACHINGWEB

Luật canonical: `.claude/rules/seo.md`. Skill này là quy trình thực thi.

## Mode A — Thêm trang public mới

Xác nhận trước: tên component, route (kebab-case tiếng Việt không dấu), title, description 150–160 ký tự, loại JSON-LD.

1. **Page** `client/src/pages/<TenPage>.jsx` (page phức tạp: thư mục `pages/<TenPage>/`) có
   `<SEO title description canonical="/route" />` từ `client/src/components/SEO.jsx`.
2. **Route lazy** trong `client/src/App.jsx`: `const TenPage = lazy(() => import("./pages/TenPage"));` và `<Route>`
   đúng vị trí trong hierarchy.
3. **Sitemap + prerender**: thêm `{ url, priority, changefreq, lastmod: today }` vào `staticRoutes` trong
   `client/scripts/generate-sitemap.js` (priority: 1.0 home, 0.8–0.9 trang quan trọng, 0.6–0.7 trang thường).
   Prerender tự lấy từ manifest `.generated/prerender-routes.json`; không sửa danh sách trong `prerender.js`.
   Route động (slug từ API) thì mở rộng logic route động và test trong `client/scripts/__tests__/`.
4. **JSON-LD** theo bảng trong rule; trang có Q&A thêm `FAQPage` vào `@graph`; URL lồng nhau thêm `BreadcrumbList`.
5. **Internal links**: 2–3 link tự nhiên tới page public liên quan (TDEE, Exercises, Kết quả khách hàng, Meal Plan, Blog)
   và ít nhất một page hiện có link tới trang mới.
6. **llms.txt**: trang quan trọng thêm một dòng vào `client/public/llms.txt`; trang phụ bỏ qua.
7. **HT Assistant**: nếu AI cần giới thiệu trang, cân nhắc cập nhật system prompt (skill `ai-chat-system`).
8. **Verify**: `npm run build --prefix client` exit 0, route có trong sitemap output và được prerender; kiểm
   `<title>`, canonical, JSON-LD trong HTML đã prerender.

## Mode B — Quét SEO (`/seo check static|rendered|live`)

Đọc [evidence modes](references/evidence-modes.md); mỗi kết luận ghi rõ mode:

| Mode | Dùng cho | Không được suy ra |
|---|---|---|
| `static` | Source, route, sitemap, prerender config | DOM hoặc response production |
| `rendered` | Meta, canonical, JSON-LD, mobile trong browser | Dữ liệu GSC/GA4/CWV thực tế |
| `live` | Status/redirect/soft-404, CWV, GA4/GSC production | Thiếu credential thì `SKIP`/`BLOCKED`, không PASS |

1. Lấy route public từ `client/src/App.jsx` (loại route sau guard admin/trainer/auth) và so với `staticRoutes`
   + manifest prerender. Lệch nhau là FAIL.
2. Mỗi page public: có `<SEO>` đủ `title`/`description`/`canonical`; trang hệ thống có `noindex`.
3. JSON-LD đúng loại theo rule. Static scan chỉ chứng minh source có schema; trước khi báo thiếu/sai phải kiểm
   rendered `script[type="application/ld+json"]`.
4. Internal links ≥ 2 tới page public khác; không có orphan page.
5. AI SEO: `client/public/llms.txt` liệt kê trang quan trọng; `client/public/robots.txt` có `Sitemap:` và chính sách
   cho AI bot (`GPTBot`, `ClaudeBot`) đúng ý định.
6. Live (khi được yêu cầu và có quyền): HTTP/redirect, PageSpeed/CWV, ảnh, độ mới nội dung, GA4/GSC.

Báo cáo:

```text
SEO CHECK — HTCoachingWeb
Evidence: static PASS/FAIL | rendered PASS/FAIL/SKIP | live PASS/FAIL/SKIP
Trang public: N | SEO component x/N | JSON-LD x/N | Internal links x/N | Sitemap x/N | Prerender x/N | AI SEO x/y
| # | Trang | Vấn đề | Severity |
RESULT: PASS | FAIL — N vấn đề
```

Sửa theo thứ tự severity khi user yêu cầu, rồi chạy lại build và check.
