# Spec: Khôi phục độ ổn định và chất lượng HT Assistant

## Objective

Khôi phục trải nghiệm chat tối thiểu bằng release ổn định trước khi mở rộng thêm:
fitness rủi ro thấp phải hữu ích, lỗi provider phải phục hồi có giới hạn, Retry giữ
đúng hội thoại và mọi claim định lượng hoặc cần nguồn phải được runtime kiểm chứng.

## Boundaries

- Giữ nguyên auth, CSRF, quota, ownership, privacy và các guard high-stakes.
- Không đổi provider/model mặc định, không mở web search cho guest và không chạy
  migration, seed hay cleanup dữ liệu thật.
- Không log raw prompt, nội dung hội thoại, dữ liệu sức khỏe hoặc query riêng tư.
- Production chỉ được rollout sau hai lượt acceptance staging liên tiếp đạt `11/11`.

## REQ-001 — Routing phải fitness-first nhưng vẫn hữu ích với kiến thức chung

- AC-001: Câu hỏi fitness ổn định/rủi ro thấp được trả bằng model prior khi KB hoặc
  catalog no-hit; câu hỏi về người thật hoặc dữ liệu cần freshness dùng `web_required`.
- AC-002: System prompt nhận routing server-side, giữ guard sức khỏe/secret và không ép
  CTA fitness vào câu hỏi general không liên quan.
- AC-003: AI eval cover incident prompts, privacy, least privilege và runtime bounds.

## REQ-002 — Knowledge Base chỉ publish khi evidence và review hợp lệ

- AC-004: Publish entry thiếu source/review bị từ chối; reviewer là dữ liệu
  server-authoritative.
- AC-005: Document legacy được giữ tương thích nhưng ở trạng thái chưa verify cho đến
  khi được review lại.

## REQ-003 — Feedback và conversation mining phải privacy-safe

- AC-006: Downvote/candidate giữ provenance giới hạn; dữ liệu nhạy cảm không tới
  embedding, AI Suggest hoặc web provider; API hội thoại chỉ trả public DTO tối thiểu.
- AC-007: UI feedback rollback optimistic state khi API lỗi và báo lỗi accessible.

## REQ-004 — Retrieval và tool contract phải nhất quán

- AC-008: Atlas/fallback giữ semantics variant/version nhất quán; search test dùng
  production defaults và không gọi telemetry là citation.
- AC-009: Registry validator chứng minh mọi AI tool có schema/implementation khớp và
  không có orphan tool.

## REQ-005 — Tích hợp phải qua gate chất lượng tương xứng rủi ro

- AC-010: Unit và live acceptance liên quan phải chạy; failure được ghi đúng là failure.
- AC-011: Client release build hoàn tất hoặc blocker môi trường được ghi rõ.
- AC-012: Secret scan, data-boundary scan và agent validation đều pass.

## REQ-006 — Output và Retry phải hoàn tất an toàn

- AC-013: Chỉ final answer đã sanitize được stream tăng dần; raw draft/tool protocol
  không đi ra browser và abort không phát thêm frame.
- AC-014: Empty/orphan brace/protocol fragment không được persist như câu trả lời hoàn
  chỉnh; failed/latest malformed Retry giữ cùng conversation, provider recovery bounded.

## REQ-007 — Numeric claims và read-only tool bắt buộc phải được runtime enforce

- AC-015: Thực đơn phải có structured items và totals do server tính. Tổng item,
  macro và `4P + 4C + 9F` nhất quán trong tolerance; target kcal và minimum protein
  là invariant. Dị ứng/thực phẩm loại fail closed khi catalog chưa review; ngân sách
  không được khẳng định nếu thiếu price provenance; follow-up sửa structured plan.
- AC-016: Khi router chọn read-only canonical tool, server thực thi đúng tool hoặc trả
  structured missing-data response. `web_required` của authenticated actor có đúng một
  canonical search attempt; trace phân biệt `not_called`, `provider_error`,
  `no_supported_source` và `grounded` mà không log raw query/prompt.
- AC-017: Workout plan giữ equipment constraint; bài cần thiết bị không có chỉ được
  xuất hiện khi kèm biến thể thực sự dùng được với thiết bị đã khai báo.
- AC-018: Release gate chạy 11 prompt live hai lượt liên tiếp và assert semantic
  invariants về kcal/macro, hard constraints, grounded source, equipment và continuity.

## Testing Strategy

Từng behavior dùng RED → GREEN qua public seam ổn định: tool unit, controller
integration, client hook/service, AI eval và Playwright. QA cuối chạy dưới Node
`22.23.1`; live staging dùng provider thật nhưng không ghi raw prompt vào telemetry.

## Open Questions

Không còn open question cho local implementation. Deploy production, cleanup dữ liệu
staging ngoài acceptance contract và thay đổi provider/model cần phê duyệt riêng.
