# Plan 076: Gửi email buổi sáng nhắc khách cập nhật sức khỏe

> **Hướng dẫn thực thi**: Follow plan theo từng vertical behavior. Không gửi mail thật,
> không chạy migration và không bật flag production. Nếu chạm file hotfix bị khóa hoặc
> cần đổi auth/CSRF contract thì dừng.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: 003B, 003G, 060, 075
- **Category**: notifications | email | scheduler | ui | privacy
- **Planned at**: 2026-08-29
- **Execution**: COMPLETE / LOCAL VERIFIED — FULL SERVER SUITE BLOCKED, PRODUCTION FLAGS OFF

## Why this matters

Khách hàng có một nhịp nhắc nhẹ vào đầu ngày và đi thẳng tới đúng action thay vì phải
tự tìm module. Opt-in trong Tài khoản tránh gửi đại trà; deterministic delivery và
suppression theo journal giảm spam cũng như chi phí provider.

## Current state

- `NotificationPreference` có in-app categories và optimistic revision nhưng chưa có email flag.
- `NotificationPreferences` đang xuất hiện trong notification surfaces, chưa có Account tab.
- `createRecurringJob` và schedule reminder đã có pattern no-overlap/claim/retry.
- `DailyJournal.status=submitted` là server-authoritative signal khách đã gửi sức khỏe ngày.
- Deep link dashboard cần preserve return path qua Google OAuth khi user đang logged out.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Focused client | `npm run test:unit:client -- --run <files>` | exit 0 |
| Focused server | `npm run test:unit:server -- --run <files>` | exit 0 |
| Client compile | `cd client && npx vite build` | exit 0 |
| Client lint | `npm run lint --prefix client` | 0 errors |
| Full client | `npm run test:unit:client` | exit 0 |
| Full server | `npm run test:unit:server` | exit 0 |

## Scope

### In scope

- Notification preference API/model/service/validation và tests.
- Morning reminder delivery model/service/mail template/start-stop lifecycle.
- Account tab, preference UI, login return path và focused client tests.
- Account deletion/privacy inventory, email/community catalogs và canonical docs.
- `server/.env.production.example` chỉ thêm safe-off flags.

### Out of scope

- Gửi email thật, deploy, commit/push, production config mutation.
- Cho user chọn giờ riêng, nhiều timezone, analytics mở email/click hoặc SMS/push.
- Refactor các email template cũ hay sửa schedule reminder behavior.
- Năm file observability/monitoring hotfix đang khóa.

## Steps

### Step 1: Lưu opt-in tại Tài khoản qua contract tương thích

**Behavior**: Coaching Customer đọc default `false`, bật/tắt trong Account và nhận
server-confirmed toast; client cũ không gửi field vẫn update được các preference cũ.

**Blast radius**: NotificationPreference model/service/controller/validation, Account page,
NotificationPreferences, i18n và API/UI tests.

**Verify**: focused notification integration + NotificationPreferences component tests.

### Step 2: Gửi đúng một email cho khách đủ điều kiện

**Behavior**: Trong window buổi sáng và khi flags bật, opted-in active customer chưa submit
journal nhận đúng một email; retry sau provider failure và không gửi trùng khi nhiều tick/instance.

**Blast radius**: delivery model, cron service, sendMail, server lifecycle, env example và tests.

**Verify**: focused cron integration và mail provider unit tests.

### Step 3: Bảo toàn deep link và privacy lifecycle

**Behavior**: CTA mở đúng health section sau login; tampered redirect bị hạ về `/`; account
deletion xóa preference và delivery ledger không chứa health payload.

**Blast radius**: AuthenticatedRoute/Login/LoginSuccess, login redirect util, Today Dashboard
privacy service và integration tests.

**Verify**: focused login utility + privacy integration tests.

### Step 4: Đồng bộ catalog, QA và review

**Behavior**: Admin catalog phản ánh notification mới và Today Dashboard history; code vượt
focused/full tests, lint, compile, UI/security/rules gates mà không tạo artifact ngoài scope.

**Verify**: catalog/report tests, full client/server, compile-only, UI regression,
`security:secrets`, `security:data-boundaries`, `agents:validate`, `git diff --check`.

## Test plan

- Happy path opt-in + active order + no submitted journal.
- Suppression: flag off, outside 07:00–08:59, preference off, inactive/HLV, submitted journal.
- Idempotency/retry: sent delivery không lặp; failed delivery retry sau delay.
- API compatibility: document cũ/default false và payload cũ không mất field.
- UI: role user thấy Account tab; email mode không làm email option xuất hiện trong in-app mode.
- Security: return path chỉ chấp nhận safe internal path.

## Done criteria

- [x] Preference default false và update contract pass.
- [x] Cron/mail/idempotency/retry/suppression tests pass.
- [x] Deep link sau login và privacy deletion pass.
- [x] Catalog và docs đồng bộ.
- [x] Client/server focused + client full QA pass; server full suite đã chạy nhưng runner kết thúc non-zero không có summary, nên không dùng làm release gate.
- [x] Không còn debug code, file mới trên 300 dòng hay diff trong hotfix files.
- [x] Plan/index được cập nhật kết quả thật.

## Local verification evidence (2026-08-29)

- Focused server: 6 test files / 34 tests cho preference, cron, mail và privacy; thêm 2 test files / 20 tests cho catalog/report — pass.
- Focused client: 3 test files / 12 tests; login redirect, email preference và health section — pass.
- Full client unit: 135 files / 610 tests — pass.
- Client lint — pass, chỉ còn một warning React Hook Form trong file trainer coordination có sẵn ngoài scope.
- Client Vite build — pass (`npx vite build`); không dùng artifact `client/dist` làm release.
- Security secrets, data boundaries, agent validation và `git diff --check` — pass.
- Full server unit đã được khởi chạy và thực thi lâu; runner kết thúc exit 1 mà không xuất failure summary. Không chạy lại vô hạn và không tuyên bố full-server pass.

## STOP conditions

- Cần thay đổi JWT/CSRF/cookie hoặc mở external domain mới.
- Cần backfill/xóa dữ liệu thật hay bật production mail/background job.
- Cần sửa một trong năm file hotfix bị khóa.
- Cùng verification fail ba vòng sau sửa có căn cứ.

## Maintenance notes

- Muốn thêm giờ riêng theo user phải thiết kế timezone/schedule preference mới, không overload
  boolean hiện tại.
- Nếu background jobs chạy nhiều replica, deterministic `_id` vẫn là boundary chống duplicate;
  reviewer phải giữ atomic claim trước provider call.
- Ledger mới không lưu health values và phải tiếp tục nằm trong account deletion inventory.
