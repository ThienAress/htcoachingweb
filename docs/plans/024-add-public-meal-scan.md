# Plan 024: Thêm trang Quét món ăn với ước tính calo và macro

> **Trạng thái**: DONE / LOCAL VERIFIED — REAL GEMINI + STRICT PRERENDER PENDING
>
> **Drift check**: Giữ nguyên thay đổi chưa commit của Plan 021–023 và các
> workstream contract/subscription; không sửa
> `server/src/middlewares/validation.js` đang dirty.

## Mức độ và phạm vi

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH (health-adjacent AI output, image privacy, provider cost)
- **Depends on**: 017, 019
- **Category**: public tool / AI / security / SEO / UI
- **Planned at**: 2026-08-03

## Change surface

- Public page `/quet-mon-an`, lazy route và navbar desktop/mobile.
- Client service gửi ảnh đã nén qua axios/CSRF hiện có.
- API `POST /api/meal-scans/analyze` theo route → controller → service.
- Dedicated image validation và per-user limiter; không đổi schema.
- Gemini/mock adapter, strict normalization và no-store response.
- SEO, JSON-LD, sitemap, prerender, `llms.txt` và Assistant page awareness.

## Các bước và tiêu chí kiểm chứng

1. Khóa spec/contract và dependency map, kiểm chứng bằng diff scoped.
2. Viết test RED cho image validation, service/provider và authenticated API.
3. Triển khai backend với auth, CSRF, limiter, timeout, deterministic mock,
   structured Gemini output và không lưu/log ảnh.
4. Viết helper/service tests client; triển khai scanner responsive đủ states,
   chỉnh gram local và disclaimer.
5. Đăng ký route/navbar/i18n, SEO/JSON-LD/sitemap/prerender/llms và internal links;
   cập nhật system prompt chỉ để dẫn link.
6. Re-trace contract; chạy focused tests, lint/build, AI/SEO/UI/security checks,
   `git diff --check`; dọn code phát sinh và ghi evidence thật.

## Done criteria

- [x] API happy path và guard auth/CSRF/type/size/provider có test.
- [x] Không schema, migration, upload storage hoặc raw image logging.
- [x] Trang public và navbar desktop/mobile hoạt động; scan yêu cầu login.
- [x] UI có range/confidence/questions và chỉnh portion tính lại tổng.
- [x] SEO, sitemap, prerender, llms và Assistant page link đầy đủ.
- [x] Verification phù hợp pass; real-provider/manual được báo rõ.

## Verification evidence

- Timestamp: `2026-08-03T12:58:06+07:00`.
- Target revision: `e2fcc24e3818a867f05c87c0131a74ede06a9fcc`; working tree dirty có
  Plan 021–023 và các thay đổi contract/subscription của user được giữ nguyên.
- Focused backend Meal Scan: PASS, 2 files và 9/9 tests.
- Focused client/SEO: PASS, 4 files và 8/8 tests.
- Full client unit suite: PASS, 45 files và 234/234 tests.
- Full server unit/integration suite: PASS, 88 files và 398/398 tests.
- Full client lint: PASS với 0 errors; 1 warning cũ trong `Pricing.jsx` ngoài
  phạm vi Meal Scan.
- Compile-only Vite build: PASS, 2.801 modules.
- Release build local fallback: PASS; Meal Scan prerender thành
  `dist/quet-mon-an/index.html`, 38/38 route khả dụng pass và bundle budget
  pass. Recipe routes động được skip theo fallback vì public API timeout; strict
  production prerender chưa chạy trong lượt này.
- Browser smoke read-only: PASS desktop 5/7, mobile 390×844 xếp dọc không overflow,
  navbar desktop/mobile, unauthenticated CTA, canonical và JSON-LD
  `WebApplication` + `FAQPage`; không có runtime console error.
- AI tool validation: PASS, 11 tools và 0 warnings.
- Secret scan: PASS.
- Repository data-boundary scan: PASS, 0 violations.
- Agent validation: PASS, 22 skills và 5 rule files.
- `git diff --check`: PASS.
- E2E authenticated upload: SKIP vì không có test account/real provider được xác
  nhận. Không gọi Gemini thật, không upload ảnh thật, không migration, không ghi
  staging/production và không deploy.

## STOP conditions

- Cần lưu ảnh/kết quả hoặc ghi dữ liệu staging/production.
- Cần nới auth, CSRF, payload bound hay rate limit.
- Cần thay schema/Daily Journal contract trong MVP.
- Cùng verification thất bại ba vòng sau các sửa có căn cứ.
