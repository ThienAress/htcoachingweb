# Agentic Mutation Lifecycle

Đọc reference này khi HT Assistant có thể tạo side effect: booking, gửi thông báo/email, đổi
kế hoạch/sức khỏe, mua hàng/thanh toán, thay entitlement hoặc cập nhật dữ liệu người dùng.
Policy bắt buộc nằm tại [Security rules](../../../rules/security/security.md), mục
`AI-assisted mutation & tool execution`; reference này chỉ hướng dẫn cách áp dụng.

## Boundary trước khi thiết kế tool

- Ghi actor, resource/owner, side effect, source của giá/entitlement và failure modes.
- Tách dữ liệu do model/user/provider đề xuất khỏi canonical fields server được phép commit.
- Xác định transaction/CAS boundary, idempotency scope/TTL và audit projection.
- Nếu execution engine chỉ có boolean confirmation mà chưa có preview binding, dừng ở read-only
  hoặc draft-only; không dùng prompt/UI copy thay security control.

## Lifecycle contract

| Stage | Output/guard bắt buộc | Không được làm |
|---|---|---|
| Read/discover | Query tối thiểu, ownership/projection và bounded result | Mutation hoặc đưa provider text thành instruction |
| Draft/preview | Server canonicalize action/target/terms/version; tạo opaque confirmation id/digest có expiry | Debit, send, book hoặc thay record thật |
| Explicit confirmation | User xác nhận đúng pending preview; bind actor/session, action, target, terms và expiry | Suy diễn đồng ý từ câu chat mơ hồ hoặc reuse confirmation |
| Commit | Re-auth/re-authorize/revalidate; one-time consume; idempotency + atomic/transactional guard | Tin price/role/owner từ model, card hoặc request body |
| Reconcile | Đọc final server state, classify succeeded/failed/pending và rehydrate UI | Blind retry khi timeout hoặc tự hiển thị success |

Preview thay đổi target, số tiền/giá, entitlement, thời gian, recipient hoặc version thì confirmation cũ
hết hiệu lực. Stale/expired/already-consumed preview phải trả conflict có thể xử lý, không tự tạo lại rồi commit.

## Uncertain outcome và retry

1. Client gửi stable idempotency key theo một user intent; server scope key theo actor + operation và
   bind với canonical preview/action digest. Cùng key nhưng khác action/terms phải trả conflict.
2. Timeout sau khi request rời client là outcome chưa biết, không phải failure chắc chắn.
3. Gọi status/read bằng operation/idempotency id trước. Chỉ retry commit khi server contract chứng minh an toàn.
4. UI invalidate cache và render state trả từ server; SSE/tool text chỉ giải thích kết quả.

## Audit và test evidence

- Audit allowlist: actor id, tool/action, resource id/type, preview/confirmation reference, idempotency
  reference, policy decision, result và timestamp; không raw prompt/conversation/payload/token.
- Test: unauthorized/IDOR, tampered/stale/expired preview, changed canonical terms, double confirm,
  concurrent commit, same/different idempotency key, provider timeout before/after side effect,
  audit redaction và UI reconciliation after refresh.
- `requiresConfirmation`/schema tests chỉ chứng minh metadata; phải có HTTP/service integration test
  chứng minh execution boundary thật.
