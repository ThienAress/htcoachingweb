# AI Technology Radar

Canonical machine-readable watchlist: `.agents/upstream-technologies/watchlist.json`.

## Review policy

- `assess`: theo dõi và chạy bounded prototype/evaluation; chưa trở thành production dependency.
- `trial`: đã có pilot default-off, ownership/security/delete tests và rollback path.
- `adopt`: được phép làm dependency hoặc kiến trúc canonical sau benchmark và ADR.
- `hold`: không dùng mới cho đến khi blocker được giải quyết.
- Mọi entry luôn `autoInstall=false`; popularity và benchmark do upstream tự công bố không phải bằng chứng đủ để adopt.

## Current radar — 2026-08-11

| Technology | Ring | Decision | Lý do và ranh giới |
|---|---|---|---|
| [TencentDB Agent Memory](https://github.com/TencentCloud/TencentDB-Agent-Memory) | `assess` | `adapt` | Học layered memory, symbolic offload và traceability. HTCOACHING chỉ pilot explicit user-controlled memory với provenance, correction/delete, TTL, context budget và isolation; không nhập automatic persona/L3 pipeline, OpenClaw/Hermes runtime hoặc benchmark claim. |

TencentDB Agent Memory hiện công bố kiến trúc memory phân tầng, local-first, đường drill-down về raw evidence và MIT
license. Đây là nguồn kỹ thuật đáng theo dõi, nhưng upstream tự động capture/extract/persona rộng hơn consent/privacy
boundary của HTCOACHING. Explicit-memory pilot local chỉ chứng minh các pattern đã adapt, không đồng nghĩa đang trial
upstream runtime. Promotion từ `assess` sang `trial` cần một evaluation riêng có benchmark, security/privacy gate,
rollback path và approval; production rollout vẫn cần approval riêng.

Review kế tiếp: 2026-09-10 hoặc sớm hơn nếu upstream đổi data model, license, security boundary hay benchmark methodology.
