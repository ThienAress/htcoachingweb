# Spec: HLV chính mặc định và HLV phụ trách thực tế

Status: APPROVED FOR LOCAL IMPLEMENTATION — 2026-09-10.

## Objective

Chủ hệ thống vừa là admin vừa huấn luyện. Đơn coaching chưa giao HLV khác thuộc
HLV chính được chỉ định. Dùng một quy tắc chung để tránh email, dashboard, báo
cáo và quyền truy cập diễn giải trainerId null khác nhau.
User đã cung cấp ObjectId; read-only production xác minh tồn tại và role admin.
Không ghi email hoặc ObjectId cá nhân vào spec/source; cấu hình theo môi trường.

## Facts và nguồn hiện tại

- Order.trainerId là ObjectId ref User, không phải email.
- morningHealthReminderCron loại orders thiếu trainerId trước gửi.
- trainerAssignment.service candidates chưa mặc định bao gồm admin.
- wellnessTargetAccess/coachingHabitAccess có admin branch rộng, trong khi
  bodyAssessmentAccess cần assigned Order; đây không phải một contract thống nhất.
- Khách bị lỗi đã có morningHealthEmail true, active approved order thiếu HLV,
  không có delivery09–10/09. Chỉ là diagnostic evidence, không export dữ liệu.
- Dirty changes086–088 đang có phải giữ nguyên; không giả chúng đã deploy.

## Proposed canonical configuration

`DEFAULT_ADMIN_TRAINER_ID` hiện có là nguồn cấu hình backend duy nhất cho lead mặc định.
Tái sử dụng `defaultAdminTrainer.service.js`, mở rộng consumer thay vì tạo resolver
cạnh tranh. Luồng schedule đã dùng resolver này, nhưng mail chưa dùng.
Fallback ADMIN_EMAIL hiện hữu phải có compatibility/deprecation rõ ràng; production
rollout chốt explicit ID đã xác minh, không dùng fallback email để định danh mới.
Giá trị là ObjectId User theo môi trường. Không dùng email fallback, không chọn
admin đầu tiên, không expose qua public endpoint. Production cấu hình bằng bước
rollout riêng; không hardcode ID hoặc đổi biến môi trường thật trong implementation.
Configured account phải tồn tại và có capability coaching hợp lệ; designated
admin được công nhận trong vai trò lead, không cần hạ role thành trainer.
Không cấu hình/ID không tồn tại/không còn capability → fail closed rõ nguyên nhân.
Không tự đổi assignment khi xóa hoặc đổi email/role tài khoản lead.

## Ownership and lifecycle

Capacity compatibility: designated lead admin's own clients retain the preexisting
admin-owned/unassigned order behavior outside commercial trainer subscription cap.
Only validated designated lead gets this path, whether assignment explicit or default;
other trainers and subscribed nonlead admins keep existing subscription limits.
Transfer preview exposes unlimited:true/maxClients:null rather than fake numeric quota.

1. Order có trainerId hợp lệ → giữ assignment rõ ràng, không fallback.
2. Legacy null/missing → effective coach là lead configured, chỉ cho coaching
   order đáp ứng lifecycle hiện có; không hồi sinh completed/cancelled/hết buổi.
3. Đơn mới do admin tạo/duyệt mà không chọn HLV → persist ID lead tại write
   boundary theo lifecycle đã trace. Đơn do trainer tạo giữ actor trainer hiện có.
4. Chuyển HLV dùng luồng chuyển assignment và audit hiện có, không updateMany tùy tiện.
5. Quyền admin vận hành giữ semantics riêng; thông báo coaching chỉ tới effective
   coach của đúng nghiệp vụ, không broadcast mọi admin hoặc khách HLV khác.
6. Client-level feature gặp nhiều active order cùng một effective coach được
   collapse; nhiều coach khác nhau phải dùng orderId scoped nếu contract hỗ trợ,
   hoặc báo conflict. Không sort latest/findOne tùy tiện để quyết định quyền.
7. Read snapshots lịch sử không tự cấp quyền. Re-auth/recheck assignment ở replay,
   transaction, mutation và private-media endpoints theo policy hiện có.
8. DTO có thể thêm effectiveTrainerId/assignmentSource nội bộ có quyền; giữ raw
   trainerId để không che dữ liệu chưa backfill. Không mở rộng PII projection.

## Shared resolver and consumers

Service dùng chung giải quyết default lead, active assignment, query scope và
conflicts; helpers batch/query để tránh N+1. Job email không chỉ thay query
`trainerId != null` thành bỏ điều kiện; phải validate effective coach.
Trace producers và consumers tối thiểu:

- order create/approve/assign, trainer assignment candidates/list/transfer;
- today/journal/weekly/progress, wellness targets, coaching habits/comments;
- BodyAssessment mới, trainer workspace/overview, recipient notifications;
- email reminder opt-in eligibility, contract consent eligibility;
- schedule/coaching/workout/private-media access khi lấy Order assignment;
- retention/account-deletion guards: default không cho revive tài khoản đã xóa;
- quota/entitlement resolver chỉ nếu tìm thấy actual dependency, không đổi giá/gói.

Review độc lập bổ sung evidence:
- trainingSchedule.controller getMyClients và trainingScheduleCommand relationship
  coi null là khách của mọi admin: cần scope lead cho workspace cá nhân, giữ admin
  quản trị riêng.
- requestActor/coachingCommentAccess chặn admin ở coach capability: cần trace cả
  middleware/actor representation, không chỉ query Order.
- contract.service create lấy admin actor làm trainer khi order null: người thao
  tác quản trị không được thay người chịu trách nhiệm; không sửa hợp đồng lịch sử.
- trainingSchedule/workoutPlanRelationship/comment chọn active order theo thứ tự
  khác nhau: test conflict multi-order trước chuyển consumer.

Không sửa auth cookies/CSRF hoặc biến `role=admin` thành role trainer. UI ownership
phải nhận metadata đã validate, không tự suy lead từ tên/email.

## Email verification

Active opted-in customer thuộc default lead phải đủ eligibility; submitted journal
vẫn suppress, sent ledger vẫn idempotent. Không gửi bù các ngày cũ tự động.
Thêm metadata tổng hợp cho cron tick: counts eligible/suppressed/claimed/sent/failed/
already handled + skip reason; không email/health payload/ID cá nhân trong logs.
Scheduler ngủ của Render là rủi ro hạ tầng riêng, không được tuyên bố resolver sẽ
khắc phục uptime hoặc đảm bảo thư tới inbox. Provider accepted != inbox delivered.

## Data migration and rollout

Implementation local không ghi production. Legacy đọc được qua resolver, chưa
cần backfill ngay. Nếu backfill: dry-run fixed target, chỉ null/missing và cohort
được user duyệt; bounded protected manifest, no raw PII in docs, audit before/after,
CAS chống assignment đổi sau dry-run, backup/rollback riêng, tuyệt đối không đè
đơn đã giao HLV khác. Không chạy apply khi chưa có xác nhận target và danh sách.
Gán lead mới sau rollout không tự chuyển mọi khách cũ ngoài ý muốn: freeze assignment
hoặc explicit migration khi đổi lead; không coi config edit là transfer được duyệt.

## Tech stack / style / commands

Express/Mongoose layering, React services+TanStack Query, Node theo .node-version.
Pattern reference: trainerAssignmentRead.service, weeklyCheckinAccess.service,
bodyAssessmentAccess.service, morningHealthReminderCron và corresponding tests.
QA: `npm run test:unit:server`, `npm run test:unit:client`, scoped integration rồi
`npm run build --prefix client` khi có UI; `npm run security:data-boundaries` và
`npm run security:secrets`; staging acceptance theo quyền riêng, không chạy tự động.

## Success criteria

- Lead admin hợp lệ đọc/ghi đúng legacy clients theo coaching policy.
- Trainer khác không đọc legacy lead clients, explicit assignment không đổi.
- No-config/deleted lead/noneligible lead fail closed; deleted client bị chặn.
- Mixed active assignments conflict có test, không leak hoặc gửi sai người.
- Newly approved unassigned order ghi lead đúng; transfers audit/concurrency pass.
- Opt-in recipient thiếu raw trainerId nhưng default hợp lệ được chọn gửi một lần.
- Opt-out/submitted/inactive vẫn bị loại; no duplicate after retry/transfer.
- Không có production data/config write hoặc email thử trong implementation.

## Next gate

User approved implementation. Migration/config production/deploy need separate approval.

## REQ-001 — Effective ownership

- AC-001: default/explicit/invalid/deleted/conflicting assignments resolve safely.
- AC-002: new orders and contracts resolve responsible coach, never operator by accident.

## REQ-002 — Consumers and verification

- AC-003: personal coach scopes and admin operations stay separate across reports/comments.
- AC-004: opted-in legacy lead customer qualifies for reminder, exclusions/retries remain.
- AC-005: integrated QA/security evidence and rollout boundaries documented.
