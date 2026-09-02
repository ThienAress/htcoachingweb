# Spec: Email buổi sáng nhắc cập nhật Mục tiêu sức khỏe

## Objective

Cho Coaching Customer chủ động bật một email nhắc buổi sáng trong `Tài khoản`.
Khi đủ điều kiện, hệ thống gửi tối đa một email mỗi ngày với lời chúc, lời nhắc cập
nhật sức khỏe và nút mở thẳng section `Mục tiêu sức khỏe` của ngày hiện tại.

Success nghĩa là preference mặc định tắt, không gửi trùng, không gửi khi khách đã
submit nhật ký sức khỏe ngày, không gửi cho HLV/Admin hoặc tài khoản không còn gói
coaching active, và provider failure được retry có kiểm soát.

## Product contract

- Chỉ role `user` thấy tab `Email nhắc sức khỏe` trong trang `/account`.
- `morningHealthEmail` mặc định `false` cho cả document mới và document cũ chưa có field.
- Preference được lưu qua API hiện có `PUT /api/notifications/preferences`, giữ optimistic
  concurrency bằng `expectedRevision` và tương thích client cũ không gửi field mới.
- Job chỉ chạy khi đồng thời có:
  - `MORNING_HEALTH_REMINDER_ENABLED=true`;
  - Today Dashboard enabled;
  - `TODAY_JOURNAL_WRITES_ENABLED=true`.
- Scheduler của email buổi sáng độc lập với `BACKGROUND_JOBS_ENABLED`; không được bật
  payment, subscription, cleanup hoặc retention cron chỉ để gửi reminder.
- Khung giao nhận là 07:00–08:59 theo `Asia/Ho_Chi_Minh`; cửa sổ rộng giúp catch-up sau
  restart nhưng deterministic delivery key vẫn giới hạn một email/user/ngày.
- Recipient phải có preference bật, role `user`, email hợp lệ và ít nhất một Order
  `approved` còn buổi với `trainerId`.
- Nếu `DailyJournal(clientId, dateKey)` đã có `status=submitted`, job suppress email.
- CTA canonical:
  `/dashboard/today/{YYYY-MM-DD}/journal#customer-health-goals-title`.
- Nếu người nhận chưa đăng nhập, login flow phải giữ internal return path và từ chối
  open redirect từ local storage/location state.
- Email không nhúng chỉ số sức khỏe, tên HLV hoặc payload nhật ký. Log không chứa email
  hay dữ liệu sức khỏe.

## Tech stack liên quan

- Express 5, Mongoose 9, MongoDB.
- Resend qua `server/src/utils/sendMail.js`.
- Recurring job qua `server/src/operations/recurringJob.js`.
- React 19, TanStack Query 5 và React Toastify.

## Cấu trúc file bị ảnh hưởng

- Preference contract: model, validation, controller, service và integration test notification.
- Delivery: model mới với deterministic string `_id`, cron service, mail template và tests.
- Runtime: register start/stop độc lập trong `server/server.js`; flag mẫu trong
  `server/.env.production.example`.
- Privacy: xóa delivery ledger cùng Today Dashboard data/account deletion.
- UI: Account tab mới, `NotificationPreferences` channel email, i18n và focused tests.
- Deep link: safe login redirect utility, AuthenticatedRoute/Login/LoginSuccess.
- Catalog: email notification catalog và Today Dashboard improvement history.

## Code style

- Giữ layering route → controller → service → model; không thêm endpoint nếu API preference
  hiện có đủ contract.
- Scheduler chỉ query field cần thiết, batch recipient và claim atomically trước side effect.
- Provider phải confirm message id; failure phải throw để delivery chuyển `failed` và retry.
- UI dùng service hiện có, TanStack Query và một toast global; không gọi API trực tiếp.

## Testing strategy

- API: default false, update true, client cũ không gửi field vẫn giữ tương thích, stale
  revision vẫn 409.
- Cron: ngoài window/flag off không gửi; active opted-in gửi một lần; submitted journal bị
  suppress; provider failure retry nhưng không duplicate sent delivery.
- Mail: escape tên, đúng CTA/date key, idempotency key, provider failure không bị swallow.
- UI: email channel chỉ hiện setting email, payload giữ các preference khác, disabled/loading
  và success/error feedback.
- Login redirect: chấp nhận internal path có hash; từ chối protocol-relative/backslash/external.

## Boundaries

- Không chạy migration, cron hay gửi email thật trong implementation/QA.
- Không commit/push/deploy và không bật production flags.
- Không sửa observability metrics/hotfix files đang bị khóa.
- Không thay đổi auth cookie, CSRF, rate limit hoặc public SEO routes.

## Success criteria

- Tất cả behavior và test nêu trên pass.
- Document cũ không cần backfill vì DTO/schema fail-safe về `false`.
- Account deletion xóa ledger mới; delivery/log không lưu health payload.
- Catalog Admin mô tả đúng trigger, recipient, condition, delivery và sender mới.

## Open questions

Không còn open question blocking. User đã chốt implementation và vị trí preference trong
Tài khoản ngày 2026-08-29.
