# Spec: P1 Security Hardening và nghiệp vụ HLV

## Objective

Khắc phục sáu finding P1 đã xác minh trong audit, đồng thời bổ sung hai công cụ vận hành đã chốt:
`Trung tâm thực hành` cho Admin/HLV và `Điều phối HLV` chỉ dành cho Admin. Kết quả phải giảm rủi ro
rò rỉ dữ liệu, IDOR, mass assignment và memory DoS mà không làm đổi hành vi hợp lệ của coaching,
workout, email, check-in, hợp đồng hoặc thanh toán.

## Tech stack liên quan

- Backend: Express 5, Mongoose 9, MongoDB transaction, Multer/Cloudinary, Resend.
- Frontend: React 19, React Router 7, TanStack Query 5, React Hook Form + Zod, Tailwind CSS 4.
- Security: JWT httpOnly cookie, CSRF middleware hiện có, role/ownership check phía server.

## Product contract

### Sáu P1

1. Video feedback của học viên được lưu dạng Cloudinary `authenticated`; database chỉ lưu storage
   metadata ổn định, còn API phát signed URL ngắn hạn sau ownership check. Record URL public cũ vẫn
   đọc được trong compatibility window. Storage key mới phải nằm trong folder canonical
   `htcoaching[/staging]/coaching-feedback-private`; metadata hoặc URL không chứng minh ownership
   không được sign/xóa. Video demo của HLV không thuộc phạm vi private hóa.
2. F1 intake draft chỉ nhận root field đúng với `step`; field hệ thống/ownership/version/audit không
   thể bị ghi từ request và update chạy Mongoose validators.
3. HLV chỉ xóa `CoachingDay` do chính mình quản lý; Admin vẫn có quyền xóa đúng target.
4. Create, đổi khách, publish và duplicate `WorkoutPlan` chỉ hợp lệ khi tồn tại Order approved còn
   buổi giữa khách và HLV tương ứng; Admin vẫn phải thao tác trên một quan hệ approved có thật.
5. Upload coaching giữ giới hạn 25 MB nhưng ownership được xác minh trước khi nhận file và upload
   stream tới Cloudinary thay vì giữ toàn bộ buffer trong RAM. Route cũ không còn nhận file.
6. Xóa tài khoản dùng một inventory privacy canonical. Dữ liệu cá nhân/health/content bị xóa, còn
   record tài chính và hợp đồng đã ký được giữ/pseudonymize theo retention thay vì xóa mù. External
   media cleanup phải retry-safe và không được giả vờ atomic với MongoDB. Xóa/thay feedback hoặc
   xóa CoachingDay ghi cleanup job trong cùng Mongo transaction với thay đổi reference; worker mới
   gọi provider và reclaim claim bị crash.

Residual đã biết: `Order`, `Contract`, wallet/payment, subscription cùng `AuditLog`/`TrainerTransfer`
append-only được giữ nguyên để không phá financial/legal/operational history, nên vẫn chứa định danh hoặc
PII cho tới khi có retention/pseudonymization policy được duyệt. Lock điều phối tạm được xóa cùng tài khoản;
implementation báo rõ boundary còn lại thay vì tự chọn chính sách dữ liệu không thể đảo ngược.

### Trung tâm thực hành

- Route/page dùng chung cho Admin và HLV đủ entitlement.
- Recipient luôn là email của authenticated user; không có input nhập email khác.
- Ba lựa chọn: email Order được duyệt, email Check-in, hoặc toàn bộ hành trình.
- Không tạo Order/Checkin thật, không trừ buổi, không tạo hợp đồng và không cấp entitlement.
- Email có nhãn `[MÔ PHỎNG]`; HLV có 2 lượt/rolling 24 giờ, Admin 10 lượt/rolling 24 giờ;
  toàn bộ hành trình tiêu thụ 2 lượt.
- Quota atomic, server-authoritative; delivery provider thất bại hoàn quota idempotent.
- Mỗi email con (`order`/`checkin`) có reservation ledger và delivery state riêng. Resend nhận
  idempotency key `practice-{requestId}-{delivery}` để retry sau crash không gửi trùng. Nếu provider
  lỗi nhưng hoàn quota chưa được database xác nhận, delivery chuyển `unknown` và API fail closed;
  không tuyên bố đã hoàn lượt.
- Endpoint mutating có protect, role/entitlement, CSRF và flood rate limit.

### Điều phối HLV

- Chỉ Admin nhìn thấy và gọi được API.
- Tab `Đơn mới — 30 ngày` đọc mọi Order trong 30 ngày gần nhất, có pagination/search/filter và ưu
  tiên pending/unassigned; Order cũ hơn vẫn ở trang Orders hiện tại.
- Tab `Chuyển HLV` có preview trước mutation, lý do bắt buộc và confirmation token/revision để chống
  stale write.
- Transaction chuyển active/pending Order, lịch tương lai đang scheduled, WorkoutPlan active/future
  và CoachingDay sang HLV mới. Check-in giữ nguyên vì theo `orderId`; nội dung/comment giữ tác giả.
- Hợp đồng sent/signed, wallet/payment và notification lịch sử không bị sửa. F1 CRM không tự chuyển
  trong bản này và phải xuất hiện thành cảnh báo preview.
- HLV nhận phải active và không vượt `maxClients` từ trainer plan catalog canonical.
- Preview/command chặn cả lịch cùng giờ bắt đầu lẫn hai khoảng thời gian chồng lấn một phần; token
  bao gồm source records, slot claims, capacity catalog và conflict state để stale write fail closed.
- Mọi lần chuyển tạo record audit append-only, hỗ trợ idempotency và lưu before/after summary.
- Order chưa có HLV vẫn có thể được Admin phân công lần đầu sau capacity lock và tạo AuditLog;
  Order đã có HLV bắt buộc dùng flow Điều phối HLV.

## Cấu trúc file dự kiến

- Security: coaching/F1/workout/user controllers, services, models, routes, validation và regression tests.
- Practice center: service access registry, mail delivery, model/service/controller/route, client service/page/navigation.
- Trainer coordination: transfer audit model, service/controller/route, client service/page/navigation.
- Migration: script private-video dry-run/idempotent; không chạy trong task này.

## Code style

- Backend theo route → controller → service → model; validation server đặt theo pattern hiện có.
- Frontend page lazy-loaded; API chỉ trong `client/src/services/`; server state dùng TanStack Query.
- Copy UI tiếng Việt, Lucide icon, đủ loading/empty/error/disabled/focus states.
- Không sửa `client/src/utils/api.js`, auth cookie hoặc CSRF flow.

## Testing strategy

- Regression integration test cho mass assignment, cross-trainer delete, arbitrary WorkoutPlan client,
  ownership-before-upload và account deletion orphan inventory.
- Unit/integration test private media serialization, quota consume/refund, email recipient và không có
  business mutation trong practice flow.
- Integration test admin-only transfer, preview, capacity, transaction, idempotency, stale conflict và
  các collection được giữ/chuyển.
- Client tests cho service contract và các trạng thái quan trọng; chạy lint/build/UI regression gate.
- Cuối task chạy secret scan, data-boundary scan, agent validator và `git diff --check`.

## Release prerequisites

- Không chạy migration trong implementation local này.
- Trước khi bật API mới trên từng môi trường, chạy preflight rồi apply có xác nhận cho
  `server/src/migrations/20260828-security-operations-indexes.js`. Unique indexes là điều kiện để
  idempotency của transfer, practice delivery và media cleanup giữ đúng khi nhiều replica chạy song song.
- `server/src/migrations/20260828-coaching-private-feedback-media.js` chỉ inventory/read-only; không có
  nhánh apply. URL Cloudinary thuộc cloud khác được phân loại `external_unknown`, không phải owned asset.

## Boundaries

### Always

- Validate ObjectId, enum, pagination, ownership và role ở backend.
- Giữ compatibility với document/video cũ và không ghi signed URL hết hạn trở lại database.
- Log security event bằng metadata allowlist, không log email/raw payload/video URL.

### Ask first

- Bất kỳ thay đổi nào cần xóa/backfill dữ liệu production, thay retention record tài chính/hợp đồng,
  hoặc mở rộng transfer sang F1 CRM.

### Never

- Không rotate/xóa MongoDB credential P0 trong task này.
- Không chạy migration/seed/cleanup trên staging/production.
- Không commit, push hoặc đưa thay đổi vào release production hiện tại.
- Không giảm giới hạn upload 25 MB chỉ để né memory pressure.

## Success criteria

- Sáu regression P1 fail trước fix và pass sau fix qua public seam phù hợp.
- Video feedback mới không có public delivery URL bền trong database hoặc response chưa authorization.
- Practice email chỉ tới email đăng nhập, đúng quota và không tạo record nghiệp vụ thật.
- Admin preview/chuyển HLV đúng capacity, transaction và audit; HLV không truy cập được API/page.
- Client build, focused tests và security gates thuộc phạm vi đều pass hoặc blocker được báo chính xác.

## Deferred

- P0 MongoDB credential rotation/deletion.
- Thực thi migration video cũ hoặc bất kỳ production mutation nào.
- Tự động chuyển F1 CRM và chỉnh nội dung hợp đồng đã sent/signed.
