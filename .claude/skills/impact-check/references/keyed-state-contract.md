# Keyed-state contract

Đọc reference này khi thay đổi `Map`/`Set`, object dictionary, cache key, dedupe key,
idempotency key, composite identifier hoặc state được lookup theo key. Mục tiêu là giữ semantics
của producer/consumer trong stack JavaScript/Node; không áp chi tiết implementation của Java HashMap.

## Contract phải chốt trước khi sửa

| Dimension | Câu hỏi cần trả lời |
|---|---|
| Canonical key | Input nào tương đương; normalize case/Unicode/whitespace/type ở đâu; composite key serialize có unambiguous không? |
| Namespace/collision | Hai domain/tenant/user/action có thể tạo cùng string không; delimiter/encoding/version có chống semantic collision không? |
| Equality | Dùng identity object hay value equality; `1`, `"1"`, `null`, missing và near-equal values được xử lý thế nào? |
| Order | Consumer có dựa vào insertion/sort order không; nếu có thì đó phải là explicit contract, không là accidental behavior. |
| Duplicate | First/last/error/coalesce; duplicate có cần idempotent hay chỉ dedupe best-effort? `Map`/`Set` riêng lẻ không tạo cross-process atomicity. |
| Lifetime | State sống request/process/persisted bao lâu; max entries/bytes, TTL/eviction/cleanup và restart semantics là gì? |
| Concurrency | Hai async call/process/worker cùng key được serialize, CAS, unique-index hoặc transaction ở boundary nào? |

Không ghép raw values bằng delimiter nếu delimiter có thể xuất hiện trong input. Ưu tiên tuple/fields
canonical hoặc encoding/versioned serialization có round-trip test. Không dùng key do client/model
cung cấp làm ownership, tenant hoặc idempotency boundary nếu server có thể derive canonical scope.

## Trace và verification

- Trace mọi producer/consumer của key, persisted field/index, cache invalidation, retry path, cleanup,
  metrics và old key format. Nếu format đổi, dùng version/dual-read/expand-contract có rollback rõ.
- Test empty/missing, equivalent và deliberately different keys, delimiter/composite-order collision,
  duplicate behavior, TTL/eviction/restart và concurrent calls cùng key.
- Với idempotency, test same actor + same intent, same key + changed payload, different actor cùng raw
  key và timeout/retry sau side effect. Outcome phải đến từ canonical record/ledger, không từ cache alone.
- Với cache, test stale/invalidation/fallback và bounded growth; cache miss không được đổi authorization
  hoặc business truth.

Nếu equality/namespace hoặc atomic boundary chưa chốt mà thay đổi có thể gây ghi nhầm, double-effect
hay cross-user collision, STOP và làm rõ contract trước implementation.
