# AI Technology Radar

Canonical machine-readable watchlist: `.agents/upstream-technologies/watchlist.json`.

## Review policy

- `assess`: theo dõi và chạy bounded prototype/evaluation; chưa trở thành production dependency.
- `trial`: đã có pilot default-off, ownership/security/delete tests và rollback path.
- `adopt`: được phép làm dependency hoặc kiến trúc canonical sau benchmark và ADR.
- `hold`: không dùng mới cho đến khi blocker được giải quyết.
- Mọi entry luôn `autoInstall=false`; popularity và benchmark do upstream tự công bố không phải bằng chứng đủ để adopt.

## Current radar — 2026-09-05

| Technology | Ring | Decision | Lý do và ranh giới |
|---|---|---|---|
| [TencentDB Agent Memory](https://github.com/TencentCloud/TencentDB-Agent-Memory) | `assess` | `adapt` | Học layered memory, symbolic offload và traceability. HTCOACHING chỉ pilot explicit user-controlled memory với provenance, correction/delete, TTL, context budget và isolation; không nhập automatic persona/L3 pipeline, OpenClaw/Hermes runtime hoặc benchmark claim. |
| [Playwright MCP](https://github.com/microsoft/playwright-mcp) | `assess` | `adapt` | Học structured browser control và accessibility snapshot cho agent. Chỉ pilot trong môi trường local/mock cô lập, pin version và so sánh với Playwright CLI + Skills hiện có; không kết nối production hay bật unsafe code execution. |
| [Anthropic Commerce Agents](https://github.com/anthropics/commerce-agents) | `assess` | `adapt` | Học staged mutation approval, provenance, server-owned identity và UI rehydration. Không nhập Python/Claude runtime, không cho agent mutation thanh toán; repo không còn maintained nên chỉ là blueprint tham khảo. |
| [System Design 101](https://github.com/ByteByteGoHq/system-design-101) | `assess` | `adapt` | Dùng như learning/decision prompts cho ADR, observability và operations. Không sao chép asset; chỉ cân nhắc đổi hạ tầng khi benchmark workload thực và SLO chứng minh nhu cầu. |

TencentDB Agent Memory hiện công bố kiến trúc memory phân tầng, local-first, đường drill-down về raw evidence và MIT
license. Đây là nguồn kỹ thuật đáng theo dõi, nhưng upstream tự động capture/extract/persona rộng hơn consent/privacy
boundary của HTCOACHING. Explicit-memory pilot local chỉ chứng minh các pattern đã adapt, không đồng nghĩa đang trial
upstream runtime. Promotion từ `assess` sang `trial` cần một evaluation riêng có benchmark, security/privacy gate,
rollback path và approval; production rollout vẫn cần approval riêng.

Playwright MCP là ứng viên cho một comparative evaluation có giới hạn với browser harness hiện tại, không phải dependency
mặc định. Commerce Agents cung cấp pattern an toàn hữu ích nhưng không phải production SDK và không được mở rộng sang
payment mutation. System Design 101 giúp đặt câu hỏi kiến trúc, không thay thế evidence định lượng hay ADR; giấy phép
`CC-BY-NC-ND-4.0` cũng khiến việc sao chép hoặc biến đổi asset không phù hợp với boundary của project.

Review kế tiếp cho ba entry mới: 2026-10-05 hoặc sớm hơn nếu upstream đổi license, security boundary, maintenance
status hay execution model. TencentDB Agent Memory giữ lịch review riêng vào 2026-09-10; không tự động gia hạn trạng
thái hiện tại.
