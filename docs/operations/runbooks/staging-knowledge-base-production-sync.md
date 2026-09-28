# Staging Knowledge Base Production Sync

## Scope

Workflow này chỉ kéo các `KnowledgeEntry` đang phục vụ AI từ production
`gym-app` sang staging `htcoaching_staging`. Nó không đọc hoặc ghi
`ChatConversation`, `users`, catalog thực phẩm/bài tập hay dữ liệu khách hàng.

Source production phải dùng credential read-only chính xác một role `read` trên
database `gym-app`. Target staging được khóa bằng `APP_ENV`, database trong
`MONGO_URI`, `MIGRATION_TARGET_DATABASE` và staging origins.

## Selection and privacy boundary

- Chỉ nhận entry `published`, `reviewed`, còn `reviewDueAt` và pass
  `validateKnowledgePublication`.
- Loại entry có `conversationId`, question/answer hash conversation hoặc source
  type `conversation`.
- Chạy `validateKnowledgeEntryPrivacy` trước khi đưa answer, variant, tag hoặc
  source metadata vào staging.
- Không copy production `createdBy`, `reviewedBy` hoặc conversation reference;
  mọi entry được gán staging admin làm owner/reviewer.
- Giữ embedding chỉ khi đúng profile staging và đủ 768 số hữu hạn; nếu không,
  giữ nội dung nhưng đặt `embeddingStatus=pending` để re-embed có kiểm soát.

## Preflight

Trong GitHub Actions `Staging Live Acceptance`, chọn `kb-sync-preflight` với
release/deploy identity của staging hiện tại. Output chỉ gồm counts, skip reasons
và SHA-256 `planDigest`, không in URI, question, answer hoặc vector.

Review các mục `skippedByReason`, `updates`, `inserts`, `embeddingPending` và
giữ lại exact digest. Nếu có privacy skip bất ngờ hoặc source role không đúng,
dừng apply.

## Apply

Chọn `kb-sync-apply` và điền đúng digest từ preflight. Script:

1. Đọc lại production và staging, xác minh plan digest không drift.
2. Upsert theo `normalizedQuestion` trong một Mongo transaction majority.
3. Không xóa entry staging-only.
4. Post-verify fingerprint từng entry đã ghi.

Apply cần `CONFIRM_STAGING_KB_SYNC=yes`, staging admin email và production
read-only secret do workflow cấp. Không chạy script với production URI ở biến
`MONGO_URI`; biến đó luôn là staging target.

## Rollback and follow-up

Sync không có thao tác xóa tự động. Nếu cần rollback, dừng AI acceptance, đối
chiếu plan/evidence và dùng bản backup staging theo runbook backup/restore; không
ghi ngược vào production. Entry có embedding pending cần chạy re-embed staging
theo `staging-knowledge-base-reembed.md` trước live smoke.

