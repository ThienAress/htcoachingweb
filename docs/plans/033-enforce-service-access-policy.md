# Plan 033: Chuẩn hóa quyền truy cập và hạn mức dịch vụ

> **Hướng dẫn thực thi**: Hoàn tất từng vertical slice bằng test RED → implementation → focused verification.
> Registry backend là source of truth; UI và middleware không lặp lại số quota.
>
> **Drift check**: Working tree có nhiều thay đổi AI, Admin, SEO và trainer đang tồn tại. Chỉ sửa các symbol thuộc
> policy/quota; không hoàn tác hoặc format lại thay đổi ngoài phạm vi.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: 026A, 027, 030, 031, 032
- **Category**: feature | security | dx | documentation
- **Planned at**: 2026-08-07
- **Execution**: COMPLETE / FOCUSED VERIFIED — FULL SERVER WORKER + PRERENDER ENV BLOCKED

## Why This Matters

Quota hiện nằm rải rác trong middleware, route, client session và tài liệu. Điều này khiến user thường vẫn có
Meal Scan 10 lượt, AI Chat authenticated không phân biệt entitlement, còn Admin không có nơi đối chiếu product
policy. Plan này tạo registry và resolver dùng chung, sau đó đưa cùng contract ra runtime metadata và dashboard.

## Scope

**In scope**:

- Registry policy, tier resolver và serializer quota backend.
- Enforcement AI Chat 5/15/30 và Meal Scan 2/3/10.
- Đồng bộ Meal Plan entitlement với resolver nhưng giữ counter lifetime hiện có.
- Admin API/page “Quyền & hạn mức”.
- Skill project giúp mọi feature dùng thử/thu phí cập nhật registry và tests.
- Spec, docs, focused tests, QA/review/cleanup.

**Out of scope**:

- Admin chỉnh quota trực tiếp, schema/migration, usage billing hoặc analytics lịch sử.
- Daily cap mới cho AI Chat, wallet debit hoặc thay provider AI.
- Deploy, production data mutation, commit hoặc push.

## Steps

### Step 1: Khóa contract canonical

Lưu bốn tier và bảng policy đã duyệt trong spec. Trace limiter, Meal Plan preview/counter, Admin routing và SSE
consumer hiện tại.

**Verify**: spec nêu rõ 2/3/10, 5/15/30, 1 preview/session, 1 lifetime và unlimited.

### Step 2: Tạo registry và tier resolver

Tạo registry immutable cùng resolver server-authoritative. Resolver ưu tiên trainer entitlement, sau đó coaching
Order còn buổi, rồi user thường; guest không truy vấn DB.

**Verify**: focused tests cover đủ bốn tier và policy matrix.

### Step 3: Enforce quota và phát metadata

Đưa limiter AI/Meal Scan sang limit động từ registry. Chuẩn hóa quota DTO `limit`, `remaining`, `resetAt`; Meal
Scan dùng JSON metadata, AI Chat dùng SSE event và JSON 429.

**Verify**: integration/middleware tests chứng minh limit và không gọi downstream sau 429.

### Step 4: Thêm Admin API và UI read-only

Thêm route → controller → service admin-only, frontend service/query và lazy page. Navigation entry nằm trong
“Hoạt động”; bảng render theo `columns`/`services` từ API.

**Verify**: non-admin 403, response contract đúng; client tests cho grouping/format và compile pass.

### Step 5: Tạo skill quản trị policy

Khởi tạo `.agents/skills/service-access-policy` bằng skill-creator, thêm metadata và cập nhật workflow map. Skill
bắt buộc trace registry, enforcement, metadata, Admin matrix, docs và tests khi thêm dịch vụ dùng thử/thu phí.

**Verify**: quick skill validation và `npm run agents:validate` pass.

### Step 6: QA, review và cleanup

Chạy focused tests trước, sau đó AI check, UI check phạm vi trang mới, client/server unit, release build, security
scans, `git diff --check` và review ba axis.

**Verify**: ghi chính xác PASS/FAIL/SKIP; không che blocker môi trường.

## Done Criteria

- [x] Registry và resolver là source of truth duy nhất.
- [x] Runtime enforce Meal Scan 2/3/10 và AI Chat 5/15/30.
- [x] Meal Scan/AI Chat hiển thị metadata quota server-authoritative.
- [x] Admin có trang “Quyền & hạn mức” chỉ đọc và admin-only.
- [x] Meal Plan entitlement dùng chung tier resolver, không tạo migration.
- [x] Skill `service-access-policy` được validator nhận diện.
- [x] Focused/full verification tương xứng đã được ghi nhận; full server và release prerender có blocker môi trường.

## STOP Conditions

- Cần migration/backfill hoặc thay đổi dữ liệu production.
- Entitlement không thể xác định từ role, TrainerSubscription và Order hiện có.
- Cần mở mutation Admin cho policy hoặc thu tiền thật ngoài scope.
- Cùng verification fail ba vòng sau các sửa có căn cứ.
