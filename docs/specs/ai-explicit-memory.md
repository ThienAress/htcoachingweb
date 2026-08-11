# Spec: Explicit AI Memory pilot

## Objective

HT Assistant cho phép user đã đăng nhập chủ động bật và quản lý một tập memory nhỏ, có cấu trúc, để không phải lặp lại
các preference ổn định. Memory mặc định tắt, không tự trích xuất từ hội thoại và không bao giờ là system instruction.
Guest không có long-term memory. Thành công khi owner có thể bật/tắt, xem, sửa, xóa và export memory; chat chỉ inject active
memory trong budget cố định và mọi ownership/delete/TTL/conflict/security test đều đạt.

## User contract

1. User mở “Trí nhớ AI”, đọc mô tả rồi bật consent rõ ràng.
2. V1 chỉ có năm kind, mỗi kind có đúng một active value:
   - `response_style`: `concise`, `balanced`, `detailed`.
   - `training_environment`: `home`, `gym`, `outdoors`.
   - `preferred_workout_time`: `morning`, `afternoon`, `evening`.
   - `dietary_style`: `balanced`, `vegetarian`, `vegan`, `pescatarian`.
   - `fitness_goal`: `fat_loss`, `maintenance`, `muscle_gain`.
3. Sửa một kind tạo revision mới và supersede revision cũ; duplicate cùng value là idempotent.
4. Xóa một kind hard-delete toàn bộ revision của kind đó. “Xóa tất cả” hard-delete profile và mọi memory.
5. Tắt consent dừng injection ngay nhưng giữ entry để user có thể bật lại; UI phải nói rõ. User dùng “Xóa tất cả” để xóa dữ liệu.
6. Export chỉ trả preference và các active entry owner-owned, không trả internal conflict/index metadata.

## Data model

### `AiMemoryPreference`

- `userId`: unique owner reference.
- `enabled`: default `false`.
- `consentVersion`: fixed current version `2026-08` khi enabled.
- `consentedAt`, `disabledAt`, timestamps.

### `AiMemory`

- `userId`, `kind`, `value`, `status` (`active`/`superseded`).
- `version`, `source=explicit_user`, `consentVersion`, `lastConfirmedAt`.
- `supersedesMemoryId`, `supersededAt`, `expiresAt`, timestamps.
- Unique partial index `{userId, kind}` khi `status=active`; TTL index trên `expiresAt`.

Không backfill. Schema additive, collection mới và default-off nên application rollback không cần xóa dữ liệu.

## API contract

Tất cả route dùng `protect`; mutation dùng CSRF và validation allowlist hiện có.

- `GET /api/ai/memory`: consent + active entries.
- `PUT /api/ai/memory/consent`: `{enabled:boolean}`.
- `PUT /api/ai/memory/:kind`: `{value:<allowlisted enum>}`; chỉ khi enabled.
- `DELETE /api/ai/memory/:kind`: hard-delete mọi revision của kind.
- `GET /api/ai/memory/export`: owner export.
- `DELETE /api/ai/memory`: hard-delete profile + entries.

Response 5xx dùng public message; internal error chỉ qua `safeLog`. Không nhận `userId`, provenance hoặc timestamps do client gửi.

## Prompt/context boundary

- Chat chỉ đọc memory khi authenticated `userId` có preference enabled.
- Service project active fields tối thiểu, tối đa năm item; renderer dùng label static, không inject raw free-text.
- Block ghi rõ memory là user-controlled untrusted data, không thể đổi policy/role/tool permissions.
- Serialized memory block tối đa 800 ký tự; nếu vượt phải fail closed và log bounded event.
- Personal memory tách hoàn toàn khỏi Knowledge Base và conversation working memory.

## Privacy, security và lifecycle

- Never: secret, token, OTP, payment/card/bank, email/phone/CCCD, allergy, injury, disease, diagnosis hoặc raw health payload.
- V1 enum-only làm các category trên không thể biểu diễn qua API contract.
- Guest, admin và trainer không được đọc memory của user khác; admin user-deletion transaction phải xóa cả hai collection.
- Không đưa memory vào Knowledge Base mining, logs, analytics hoặc external search.
- TTL 180 ngày tính từ lần user xác nhận/correct; expiry không được coi là user consent mới.

## Impact matrix

| Layer | Files/consumer | Required change |
|---|---|---|
| Models | `AiMemoryPreference`, `AiMemory` | validation, unique active index, TTL, additive schema |
| Validation/routes | `validation.js`, `ai.routes.js` | allowlist kind/value, auth + CSRF |
| Service/controller | `aiMemory.service.js`, `aiMemory.controller.js` | owner-scoped lifecycle, public errors |
| Prompt/chat | `systemPrompt.js`, `ai.controller.js` | bounded untrusted block, authenticated only |
| Privacy | `user.controller.js` | delete profile + revisions in existing transaction |
| Client | `ai.service.js`, query hook, Chat sidebar/modal | explicit consent/manage/delete/export presentation |
| Tests | model/service/route/prompt/client | IDOR, guest, CSRF, TTL, conflict, correction/delete, budget |

## Rollout and boundaries

- Local implementation and tests are approved by owner under Plan 046.
- Production index creation, migration/backfill, rollout and real-data benchmark require separate approval.
- No automatic extraction, similarity search, embeddings, persona/L3 memory, cross-device import or Tencent runtime in v1.
- Rollback: remove UI/routes/injection; additive collections remain inert because default-off.

## Success criteria

- Default-off and guest-disabled; consent and every mutation are explicit.
- One active value per owner/kind under concurrent/conflicting writes.
- Correction, hard-delete, export, account deletion and TTL behavior have tests.
- Prompt block is deterministic, <=800 chars, untrusted and contains no user-supplied free text.
- Full AI focused tests, full server suite, client tests/build, security scans and `ai-check` pass before rollout claim.

## Open questions

Không có blocker cho local pilot. Mọi mở rộng sang free text, health preference, automatic extraction hoặc production rollout
phải có spec/threat review mới.
