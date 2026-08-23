# Plan 061: Harden SEO fallback và đồng bộ một chiều một tài khoản test

## Status

- **Priority**: P0/P1
- **Effort**: L
- **Risk**: HIGH — dữ liệu xuyên môi trường và public SEO runtime
- **Depends on**: 008, 038, 053A, 060
- **Category**: bug / operations / security
- **Planned at**: 2026-08-22
- **Execution**: IN PROGRESS

## Why This Matters

Google đang hiển thị một sitelink có snippet là raw lỗi dynamic import. Đồng thời
tài khoản test canonical ở production cần được phản chiếu xuống staging/local để
kiểm thử giao diện mà không cho phép dữ liệu đi ngược hoặc làm lộ credential.

## Current State

- `ErrorBoundary.jsx` render trực tiếp `error.message`; lỗi stale Vite chunk vì vậy
  có thể trở thành rendered text và bị Google dùng làm snippet.
- Sitelinks là phần Google tạo tự động. Search kết quả thương hiệu có sitelink là tín
  hiệu Google hiểu cấu trúc site, không chứng minh mọi truy vấn đã tăng rank.
- Plan 008 đã từng one-shot 15 documents/9 collections nhưng script không còn trong
  branch hiện tại và không có pipeline định kỳ.
- Local MongoDB dùng persistent `.local-data`; credential pull-only được bảo vệ bằng
  Windows DPAPI CurrentUser. Không được hạ guard hoặc ghi secret vào command line.

## Scope

**In scope**:

- ErrorBoundary recovery, no-snippet/noindex fatal fallback và prerender validation.
- Spec/contract/script pull-only cho exact test account production → staging/local.
- Focused tests, dry-run, one-shot apply, verify fingerprint và lịch staging/local.
- Tài liệu vận hành không chứa URI, raw document hoặc secret.

**Out of scope**:

- Không điều khiển trực tiếp sitelink Google, cam kết thứ hạng hoặc xóa cache Google.
- Không copy password/token/session, không copy User khác, không ghi/xóa production.
- Không xóa record target khi production xóa trong phiên bản đầu.
- Không tự tạo production database credential quyền rộng để thay read-only credential.

## Steps

### Step 1: Reproduce và khóa contract

Tạo RED tests chứng minh raw chunk error hiện lọt vào fallback và contract sync từ
chối email/source/target ngoài allowlist, đồng thời strip auth fields.

**Verify**: focused tests fail đúng assertions mới trước implementation.

### Step 2: Implement SEO runtime recovery

Tách helper nhận diện stale dynamic import, reload tối đa một lần bằng session guard,
render copy cố định có `data-nosnippet`, đặt robots noindex ở fatal state và bắt
prerender reject fallback.

**Verify**: ErrorBoundary/recovery tests xanh; prerender validation test reject fatal
snapshot; client lint không tạo warning mới.

### Step 3: Implement account graph pull-only

Xây contract cố định identity/DB, collection allowlist + selectors, sanitizer User,
fingerprint BSON ổn định, dry-run/apply/verify. Runtime xác minh source chỉ có đúng
role `read@gym-app`; target apply + verify chạy trong một transaction và script không
có delete path.

**Verify**: unit/integration tests chứng minh không kéo account khác, giữ `_id`, dry-run
zero writes, apply idempotent, reject write privilege và rollback toàn graph khi lỗi.

### Step 4: Preflight và one-shot apply

Khôi phục Doppler, xác minh production exact match và counts không in raw data; chạy
dry-run riêng staging/local. Chỉ apply khi source/target guard và allowlist đều sạch.

**Verify**: source/target counts và sanitized fingerprints khớp; production write
count bằng zero theo code path/evidence; runtime local đọc đúng `htcoaching_local`.

### Step 5: Scheduling và release

Cấu hình staging schedule với read-only production credential; đăng ký local task chỉ
khi PC/MongoDB sẵn sàng. Chạy QA/security/SEO, tạo PR, merge và theo dõi deploy theo
ủy quyền của owner.

**Verify**: workflow dispatch thành công, lịch có concurrency lock; local task có lần
chạy thành công; CI/deploy xanh; production URL trả asset mới.

### Step 6: Google recrawl

Sau production deploy, dùng Search Console URL Inspection cho URL sitelink lỗi và
request indexing. Ghi nhận đây là cache lifecycle của Google, không phải deployment
failure nếu snippet chưa đổi ngay.

**Verify**: URL live test không render fatal fallback; recrawl request đã gửi hoặc
owner được bàn giao đúng URL khi Search Console cần phiên đăng nhập của họ.

## STOP Conditions

- Exact email source match khác một, source không chứng minh là production hoặc URI
  target không đúng staging/local.
- Chỉ có production credential quyền ghi trong khi scheduler yêu cầu read-only.
- Selector có thể kéo document thuộc User khác hoặc verify fingerprint không khớp.
- Apply cần delete, đổi `_id`, migration/schema hoặc raw export ra filesystem.

## Done Criteria

- [ ] Raw technical error không còn indexable; stale chunk recovery không reload loop.
- [ ] Contract/tests account sync xanh và source chỉ có read operations.
- [ ] Staging/local cùng sanitized account graph với production sau apply.
- [ ] Scheduler staging/local được chứng minh hoặc blocker credential/runtime được ghi rõ.
- [ ] QA/security/SEO/deploy evidence hoàn tất; không có secret/raw snapshot trong Git.
