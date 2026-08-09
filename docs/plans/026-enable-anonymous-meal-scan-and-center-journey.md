# Plan 026: Mở Meal Scan anonymous có quota và căn giữa hành trình sử dụng

> **Hướng dẫn thực thi**: Thực hiện tuần tự, giữ CSRF/image validation và chạy đúng
> verification trước khi chuyển bước. Không deploy, không gọi provider live và không ghi dữ liệu thật.
>
> **Drift check**: Working tree đang dirty bởi các plan trước. Chỉ sửa Meal Scan route/rate-limit,
> production config, Meal Scan UI/i18n/E2E và tài liệu 026; không sửa JWT/CSRF/axios internals.

## Status

- **Execution**: DONE — AUTH QUOTA SUPERSEDED BY 026A / NOT DEPLOYED
- **Priority**: P1
- **Effort**: M
- **Risk**: HIGH (anonymous AI cost, auth boundary, public UX)
- **Depends on**: 024, 024A, 025
- **Category**: security / API / UI / SEO / tests
- **Planned at**: 2026-08-04

## Why This Matters

Trang đã public và indexable nhưng action hiện bắt đăng nhập trước khi user thử giá trị cốt lõi.
Anonymous trial giảm friction, còn quota 2 lượt/24 giờ theo IP giới hạn chi phí. UI được căn giữa,
thêm benefit pills, hướng dẫn nhanh và nhãn bước để hành trình quét rõ hơn mà không đẩy tool quá sâu.

## Current State

- `server/src/routes/mealScan.routes.js` dùng `protect → csrf → limiter → validation` nên anonymous bị 401.
- `server/src/middlewares/aiRateLimit.js` chỉ có quota user 10 lượt/giờ.
- `client/src/pages/MealScan/MealScan.jsx` dừng `handleAnalyze` khi `user` rỗng.
- `client/src/pages/MealScan/MealScanUploader.jsx` hiển thị login CTA thay cho analyze CTA.
- Hero và các section heading đang căn trái; hai cột chưa có nhãn bước.

## Commands You Will Need

| Purpose | Command | Expected |
|---|---|---|
| Focused server | `cd server && npx vitest run src/routes/__tests__/mealScan.routes.integration.test.js` | exit 0 |
| Focused E2E | `npx playwright test e2e/meal-scan.spec.js --project=chromium` | exit 0 |
| Client lint | `cd client && npx eslint src/pages/MealScan` | exit 0 |
| Compile | `cd client && npx vite build` | exit 0 |

## Scope

**In scope**:

- Optional-auth wrapper tái sử dụng `protect` khi có access cookie; không đổi JWT semantics.
- Anonymous quota mặc định 2 provider-bound scans/24 giờ/IP; user quota giữ 10/giờ/user.
- CSRF và image validation trước quota; ảnh đi provider kể cả `422` vẫn tính lượt.
- Centered hero/section headers, benefit pills, quick guide trước tool, step labels trên hai cột.
- Anonymous analyze CTA/copy; barcode lookup vẫn yêu cầu đăng nhập.
- Spec, production env validation, integration/E2E và QA evidence.

**Out of scope**:

- Redis/shared rate-limit store, fingerprinting, CAPTCHA, pricing/quota theo gói.
- Sửa `auth.middleware.js`, `csrf.js`, `client/src/utils/api.js` hoặc AuthContext.
- Persist raw IP, ảnh hoặc kết quả; deploy/commit/push/provider live call.

## Steps

### Step 1: Khóa anonymous API contract bằng integration test

Sửa `server/src/routes/__tests__/mealScan.routes.integration.test.js` để cover anonymous + CSRF,
hai lượt provider-bound thành công và lượt thứ ba `429`, payload invalid không gọi provider, cùng
authenticated path không bị anonymous quota chặn.

**Verify**: focused server test phải RED trước implementation rồi GREEN sau implementation.

### Step 2: Thêm optional auth và quota phân tầng

Thêm middleware wrapper nhỏ, tách anonymous/auth limiter trong `aiRateLimit.js`, đổi thứ tự route.
Thêm env defaults và production-readiness validation cho cả hai giới hạn.

**Verify**: focused integration pass; response luôn `private, no-store`, CSRF vẫn trả `403` khi thiếu.

### Step 3: Cập nhật public journey

Cho `handleAnalyze` chạy khi anonymous; uploader luôn có analyze CTA và copy 2 lượt/ngày. Center hero,
đổi ba benefit thành pills, thêm quick guide compact trước grid, nhãn `Bước 01/02`, center headings phía
dưới. Barcode lookup chỉ render cho authenticated user.

**Verify**: lint + E2E authenticated và anonymous; viewport 390 px không overflow.

### Step 4: Re-trace và QA

Đối chiếu spec/API/UI/error codes, chạy focused/full checks tương xứng, security scans và cleanup.

## Test Plan

- Anonymous matching CSRF + valid image → `200`, provider called.
- Anonymous missing CSRF → `403`, provider not called.
- Invalid MIME/oversize → fail before quota/provider.
- Hai provider-bound calls/IP/24h allowed; call thứ ba → `MEAL_SCAN_ANONYMOUS_LIMITED`.
- Authenticated user giữ quota/user hiện tại và private response.
- E2E anonymous upload → result; authenticated review/barcode vẫn hoạt động; mobile no overflow.

## Done Criteria

- [x] Anonymous user quét được tối đa 2 lượt/24 giờ/IP mà không đăng nhập.
- [x] CSRF, payload bound, no-store và paid-Gemini gate không bị nới.
- [x] Authenticated quota không regress; barcode lookup vẫn protected.
- [x] Hero/guide/next centered, pills và step labels đúng vi/en, responsive.
- [x] Focused tests, E2E, lint/build và security gates pass.
- [x] Không deploy/commit/push hoặc ghi dữ liệu/provider live.

## Verification Evidence

- Focused backend: 4 files, 27/27 tests pass; HMAC limiter hardening được re-check
  bằng route integration 8/8; focused client Meal Scan service 1 file, 2/2 pass.
- Full regression: client 52 files, 253/253 tests pass; server 100 files,
  448/448 tests pass.
- Meal Scan E2E Chromium: 5/5 pass cho anonymous, localized quota error,
  authenticated barcode/review/confirm và viewport 390 px.
- SEO route tests: 4 files, 12/12 tests pass.
- ESLint client: 0 errors; còn 1 warning ngoài scope tại Pricing.jsx.
- Release build: Vite compile pass, prerender 785/785 routes và bundle budget pass;
  Meal Scan chunk sau khi gộp hướng dẫn khoảng 46.7 KB raw / 11.4 KB gzip.
- UI check scoped: không có gradient/slop mới; heading hierarchy hợp lệ, overlay blur
  đúng ngữ cảnh, control tương tác trong vùng sửa đạt tối thiểu 44 px và mobile không overflow.
- Security/quality: anonymous memory key dùng HMAC salt theo process, secret scan pass,
  repository data-boundary 0 violations, dependency audit policy 4/4 pass và agent
  instruction validation pass; git diff/task whitespace check pass.
- Không deploy/commit/push, không gọi Gemini/provider live và không ghi dữ liệu thật.

## STOP Conditions

- Cần sửa JWT/CSRF/axios internals để anonymous hoạt động.
- Cần lưu raw IP hoặc scale nhiều instance nhưng chưa có shared rate-limit store được duyệt.
- Verification security/API fail ba vòng hoặc yêu cầu mở anonymous barcode/provider khác.

## Maintenance Notes

- Memory rate limit là best-effort theo từng server process; trước khi scale nhiều Render instances,
  chuyển sang shared store mà vẫn hash/minimize identifier.
- `MEAL_SCAN_ANONYMOUS_DAILY_LIMIT` là server-authoritative; UI copy phải đồng bộ với default 2.
