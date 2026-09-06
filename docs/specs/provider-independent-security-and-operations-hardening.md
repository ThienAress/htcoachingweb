# Spec: Hardening bảo mật và vận hành không phụ thuộc nâng provider

## Mục tiêu

Khắc phục bảy khoảng trống có thể xử lý hoàn toàn trong codebase hiện tại, không yêu cầu mua gói,
gọi API quản trị provider, tạo backup production, chạy migration hay deploy. Mọi telemetry chỉ ghi
metadata định lượng có cardinality hữu hạn; không ghi token, nội dung hội thoại, ảnh, email, user ID,
Cloudinary public ID, SePay payload hoặc URL webhook.

## Phạm vi và boundary

- Client/server Meal Scan, dependency lock của server, migration guard, restore verifier,
  Cloudinary privacy gate, Auth metrics và provider-usage metrics.
- Production readiness và runbook được phép fail closed khi thiếu bằng chứng ngoài repository.
- `docs/operations/production/backup-readiness.json` vẫn là pointer secret-free; code không tự sửa
  evidence này.
- Cloudinary backup cho F1/coaching media nhạy cảm vẫn bị cấm. Chỉ policy đã duyệt cùng canary
  synthetic public và authenticated/private mới có thể mở một class không nhạy cảm trong tương lai.
- Không ước tính tiền bằng bảng giá hardcode. Code xuất usage units; dashboard/billing reconciliation
  áp giá hiện hành bên ngoài repository.

## REQ-001 — Consent Meal Scan phải explicit và mặc định từ chối

- **AC-001**: Dialog phân tích có checkbox riêng, mặc định `false` mỗi khi chọn/xóa ảnh; nút xác nhận
  bị disable cho tới khi user opt in và copy nói rõ ảnh được gửi tới Google Gemini; disclosure phải
  cover worst-case Free/Unpaid data use và khả năng human review theo Meal Scan contract canonical.
- **AC-002**: `analyzeMeal` nhận boolean consent từ caller, fail closed nếu không phải `true`, và chỉ
  gửi `providerDataUseAccepted: true` sau opt-in. Server tiếp tục là enforcement boundary.

## REQ-002 — Dependency `fast-uri` phải ở nhánh 3.x đã vá

- **AC-003**: Server lock resolve `fast-uri >=3.1.7 <4`; `npm ls` không còn `3.1.5` và focused server
  tests không regress.

## REQ-003 — Production migration phải bind backup evidence hiện hành

- **AC-004**: Shared migration guard đọc manifest canonical, yêu cầu `releaseReady=true`, exact
  `MIGRATION_BACKUP_SNAPSHOT_ID === latestVerifiedBackup.backupId` và freshness theo clock kiểm tra.
  Staging giữ target/confirmation contract hiện tại và không bị buộc dùng production backup.
- **AC-005**: Mọi migration đang dùng shared guard nhận cùng behavior; không còn helper backup riêng
  bị drift ở một vài migration.

## REQ-004 — Restore verifier phải kiểm GridFS/PDF contract

- **AC-006**: Verifier read-only kiểm mọi contract `signed` có ObjectId, file tương ứng trong
  `contracts.files`, `metadata.contentType=application/pdf`, length dương, đủ chunks liên tục theo
  chunk size, reconstructed bytes bắt đầu bằng PDF signature và SHA-256 khớp `fileHash`. Legacy file
  thiếu content type được report bằng code riêng để owner review, không bị nhầm là MIME sai.
- **AC-007**: Orphan file/chunk, missing file, invalid metadata, chunk gap/size/hash mismatch đều làm
  verifier fail closed; output chỉ có counts và error codes/contract refs hữu hạn, không in PDF bytes
  hay dữ liệu hợp đồng.

## REQ-005 — Cloudinary backup-version privacy phải có gate rõ

- **AC-008**: Policy module phân loại `user_avatar`, `f1_private_image` và
  `coaching_private_video` là sensitive; upload mới của các class này ép Cloudinary `backup: false`
  ngay cả khi global automatic backup đang bật. Việc bỏ override này cần một spec/lifecycle và
  owner/legal approval mới.
- **AC-009**: Production readiness luôn chặn `CLOUDINARY_BACKUP_ENABLED=true` cho tới khi mọi upload
  class, public opt-in và lifecycle xóa avatar đã được inventory/review. Active-asset delete không
  được báo là purge backup version; runbook ghi riêng restore/purge evidence bằng canary synthetic.

## REQ-006 — Auth cutover phải có metrics trực tiếp

- **AC-010**: Metrics có counters cho refresh success/missing/rejected/5xx, reuse detected và logout
  success/5xx; controller/service tăng đúng counter mà không log credential hoặc session identity.
- **AC-011**: Prometheus snapshot và cutover runbook dùng chính các tên metric này để quan sát,
  đồng thời giữ HTTP 403/5xx aggregate hiện có.

## REQ-007 — Theo dõi usage/cost driver của provider

- **AC-012**: Gemini ghi request/result/failure cùng prompt/output/total token units cho Chat và Meal
  Scan; không ghi prompt, response hoặc ảnh.
- **AC-013**: Resend ghi attempts/sent/failed/disabled; Cloudinary ghi upload/delete, bytes và failure;
  SePay ghi API requests/pages/transactions/failures; Netlify ghi scheduled/coalesced/triggered/failed.
- **AC-014**: Registry metric có cardinality hữu hạn, reject tên lạ, reset được trong test và xuất
  Prometheus. Runbook giải thích counters là process-local usage signals, không thay provider billing,
  durable ledger hay spend cap.

## Testing strategy

- Client Vitest cho service consent, dialog opt-in và privacy copy.
- Server Vitest cho migration guard, GridFS/PDF verifier, Cloudinary privacy/readiness, Auth và từng
  provider instrumentation seam.
- Node test cho restore-verifier contract/CLI parsing không cần database thật.
- Chạy AI checks vì Gemini provider/logger thuộc AI subsystem; sau đó chạy QA, security scans,
  agent validation và diff hygiene tương xứng rủi ro.

## Ngoài phạm vi

- Bật Atlas/Cloudinary backup, PITR, purge version live, gọi billing/quota dashboard hoặc đặt giá tiền.
- Tạo/restore backup production, migration/backfill, seed, staging acceptance, deploy hoặc secret change.
- Thay đổi schema dữ liệu, quota entitlement, Auth token/cookie semantics hay xóa residual data thật.
