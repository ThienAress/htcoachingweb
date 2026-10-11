# Spec: HT Assistant fitness-first và Knowledge Base có bằng chứng

## Objective

HT Assistant phải ưu tiên chuyên môn fitness nhưng vẫn trả lời hữu ích các câu hỏi kiến thức chung an toàn.
Flash Lite tiếp tục là model mặc định; chất lượng được nâng bằng routing, nguồn đã kiểm chứng, retrieval có đo lường
và feedback loop thay vì tăng chi phí model cho mọi request.

Thành công khi câu hỏi fitness/HTCOACHING dùng đúng Knowledge Base hoặc web evidence, câu hỏi general ổn định
được trả lời trực tiếp, câu hỏi mới nhất hoặc claim về người thật không được khẳng định khi chưa có nguồn, và admin
có thể biết một câu trả lời dựa trên evidence nào để sửa tri thức kém chất lượng.

## Assumptions đã được duyệt

1. Định vị sản phẩm là **fitness-first, generally helpful, safety-bounded**, không còn fitness-only.
2. Câu hỏi general an toàn và ổn định vẫn được trả lời bằng Flash Lite, ngắn gọn và tính một lượt quota như fitness.
3. Không mở Google Search cho guest trong slice này; guest hỏi dữ liệu cần freshness được thông báo giới hạn xác minh.
4. Knowledge Base tiếp tục chuyên sâu về fitness, HTCOACHING và dữ liệu nội bộ; không trở thành bách khoa general.
5. Không đổi model mặc định, quota thương mại, auth, CSRF hoặc rate-limit.
6. Schema mới additive và tương thích document cũ. Không backfill/migration/deploy hoặc ghi production trong task local.

## Phạm vi trả lời và evidence routing

Mỗi request được phân loại rule-first theo bốn chiều:

- `domain`: `ht_service | fitness | adjacent | general`.
- `freshness`: `stable | time_sensitive`.
- `evidence`: `internal_kb | web_required | model_prior`.
- `risk`: `low | high_stakes | disallowed`.

Hành vi:

- `ht_service`: ưu tiên system prompt, Knowledge Base và tool canonical; KB miss không tự chuyển sang web vì thông tin
  dịch vụ phải đến từ nguồn nội bộ server-authoritative.
- `fitness + stable + low`: ưu tiên Knowledge Base/tool canonical như lớp enrichment, nhưng KB/tool no-hit vẫn trả
  lời hữu ích bằng model prior an toàn; không tự chuyển sang web và không từ chối chỉ vì catalog thiếu dữ kiện.
- Fitness chỉ chuyển sang `web_required` khi chính claim cần freshness/nguồn hoặc nói về người thật. HT service,
  high-stakes và dữ liệu server-authoritative tiếp tục giữ fail-closed/bounded guard riêng, không dùng fallback này.
- `adjacent`: trả lời hữu ích ở mức vừa, không ép CTA fitness.
- `general + stable + low`: trả lời trực tiếp, ngắn, không chạy RAG nội bộ hoặc web search không cần thiết.
- `time_sensitive`, user yêu cầu nguồn, hoặc claim về thói quen/thành tích người thật: `web_required`.
- Nếu `web_required` nhưng actor không có quyền search hoặc search lỗi: nêu chưa thể xác minh, không fallback sang
  khẳng định từ trí nhớ.
- Web search chỉ được chạy bằng standalone `retrievalQuery` của user đã qua privacy gate ở server; bỏ qua query do
  model tự sinh, kể cả khi model gắn thêm tên riêng hoặc chỉ số cơ thể. Nếu query canonical không đủ điều kiện,
  không expose/chạy web tool, ghi reason `external_privacy_blocked` và vẫn fail-closed với `web_required`.
- Chỉ phần trả lời nằm trong `groundingSupports` trỏ tới `groundingChunks` HTTPS hợp lệ mới được coi là web evidence.
  Không lấy toàn bộ model text chỉ vì response có URL. Với `web_required`, trả trực tiếp các đoạn đã support kèm
  nguồn sau sanitizer, không mở thêm chat-model turn để tổng hợp lại rồi gắn nguồn vào claim không được hỗ trợ.
  Link/URL do model tự viết trong đoạn supported không được render thành nguồn; chỉ dựng link từ chunk hợp lệ,
  và đoạn chỉ còn URL sau khi loại link tự viết không đủ làm evidence.
- Tên có một cách hiểu phổ biến được trả lời bằng giả định minh bạch; chỉ hỏi lại khi có nhiều khả năng ngang nhau
  hoặc nhầm danh tính gây rủi ro.
- High-stakes health chỉ cung cấp thông tin giáo dục và escalation phù hợp; khi KB miss thì không externalize query,
  không mở web tool và trace đúng là `model_prior`. Emergency/self-harm trả lời tĩnh trước khi gọi retrieval/provider;
  disallowed/private/secret bị từ chối ngắn. Safety phải kiểm tra toàn bộ cửa sổ message trước khi cắt query retrieval.

## Knowledge Base evidence contract

Mỗi entry mới phải hỗ trợ:

- `sources[]`: loại nguồn, tiêu đề, publisher, HTTPS URL khi là nguồn ngoài, ngày xuất bản/truy xuất và evidence tier.
- `evidenceLevel`: `legacy_unverified | editor_reviewed | source_backed | canonical_internal`.
- `reviewStatus`: `needs_review | reviewed | stale`, cùng `reviewedBy`, `reviewedAt`, `reviewDueAt`.
- `freshnessClass`: `stable | periodic | time_sensitive` và revision additive.
- Nguồn conversation lưu định danh question/answer, thời điểm capture và hash; không snapshot thêm raw PII.

Entry tạo mới chỉ được publish khi embedding sẵn sàng, review server-authoritative hoàn tất và evidence phù hợp.
`canonical_internal` chỉ dùng cho category HTCOACHING nội bộ. Entry production cũ không bị xóa hoặc tự nâng thành
verified; chúng được biểu diễn là legacy để admin re-review dần.

## Privacy, poisoning và feedback loop

- Conversation mining chỉ lấy user đã đăng nhập như hiện tại, loại assistant answer bị downvote và loại/redact cặp
  có PII hoặc dữ liệu sức khỏe cá nhân trước khi gửi provider. Cùng một privacy gate chặn dữ liệu định danh/sức khỏe
  ở cả embedding retrieval, AI Suggest và web search; không để tên riêng, DOB, bệnh/thuốc hoặc biometrics riêng tư
  đi qua các sink bằng cách trộn cùng claim về người nổi tiếng. DOB public chỉ được ngoại lệ khi chính user xác định
  rõ người công khai đó và từng mệnh đề DOB đều gắn đúng danh tính đã xác thực.
- Nội dung hội thoại/KB luôn là untrusted data, không thể thay system policy hoặc tool permission.
- AI Suggest trả về ứng viên cần kiểm chứng, giữ conversation/message provenance; không gọi chúng là “hay nhất”.
- Assistant message lưu bounded `answerTrace`: KB entry IDs đã retrieve, evidence mode, web-search-used, model và
  prompt contract version; không lưu raw prompt/search query trong trace.
- Downvote tạo review item `pending`; admin có thể `resolved` hoặc `dismissed`. Endpoint admin chỉ trả projection
  tối thiểu cần cho review.
- UI feedback phải rollback optimistic state khi API lưu thất bại.
- Câu trả lời cuối đã qua output sanitizer phải được gửi thành nhiều SSE text frames để UI hiển thị tăng dần. Raw
  draft trước tool call và protocol nội bộ không được stream ra browser; tool flow vẫn có thể reset trạng thái chờ.

## Retrieval quality contract

- Chỉ chạy KB retrieval khi router chọn `internal_kb`; follow-up được dựng thành query độc lập có giới hạn khi cần.
- Atlas và fallback phải có semantics nhất quán cho variants và embedding version.
- Profile embedding question-answering mới phải version hóa; rollout/re-embed là bước riêng, không trộn vector profile.
- Search Test mặc định dùng cùng `limit=3` và `threshold=0.75` với production; exploratory mode phải được ghi rõ.
- Bộ golden queries đo top-1/top-3, no-hit, variant coverage, stale/legacy handling và public-person routing.
- `usageCount` hiện hữu được coi là retrieval telemetry, không được trình bày như bằng chứng model đã sử dụng entry.

## Tech Stack liên quan

- Server: Express 5, Mongoose 9, Gemini Flash Lite, Gemini Embedding 2, Atlas Vector Search, Vitest.
- Client: React 19, TanStack Query 5, Tailwind CSS 4, Vitest.
- Security: JWT httpOnly cookie, CSRF, admin role gate, safe structured logging.

## File impact và testing strategy

- Server: `requestRouter.js`, `knowledgePrivacy.js`, `ai.controller.js`, `searchKnowledge.tool.js`,
  `embedding.service.js`, Knowledge Base model/controller/routes và migration compatibility helper.
- Client: Admin Knowledge Base form/search/review, chat feedback và SSE stream pacing.
- Deterministic tests với synthetic fixtures kiểm tra router/privacy/grounding, KB publish/legacy/variant,
  controller SSE/trace/Stop và client rollback/loading/error; không gọi live Gemini/Atlas.
- Local commands: `npm run test:unit`, `npm run test:ai-eval`, `npm run build --prefix client`,
  `npm run security:secrets`, `npm run security:data-boundaries`, `npm run agents:validate`.
  Full release build, E2E hoặc provider/live validation chỉ được ghi PASS khi thực sự chạy thành công.

## Boundaries

- Always: additive schema defaults, server-owned reviewer fields, HTTPS/source validation, bounded provider payload,
  privacy redaction, admin ownership/CSRF và deterministic regression tests.
- Ask first: production re-embed/backfill/index change, bật search cho guest, đổi quota hoặc provider/model mặc định.
- Never: gửi raw PII/health profile vào embedding/AI Suggest/web search; coi conversation answer là verified source; log raw
  prompt/conversation; tự deploy hoặc chạy data mutation trên staging/production.

## REQ-001 — Routing phải fitness-first nhưng vẫn hữu ích với kiến thức chung

- AC-001: “Lisa là ai?” route `general + stable + model_prior`, trả lời trực tiếp theo giả định hợp lý, không chạy
  KB/search; “Ronaldo thường tập gì?” route `fitness + web_required`; “Cách squat đúng?” ưu tiên internal evidence
  nhưng no-hit ở câu fitness ổn định/rủi ro thấp vẫn trả model prior thay vì ép web hoặc từ chối.
  Web call lưu/chạy query canonical đã privacy-check, không dùng model-generated args; query private không expose tool.
  Chỉ các đoạn có support-to-HTTPS mapping được trả cùng nguồn ngay sau một chat-model turn; link do provider tự
  viết không được coi là nguồn hoặc source-launder text.
- AC-002: System prompt nhận quyết định routing server-side, giữ guard sức khỏe/secret và không ép CTA fitness vào
  câu hỏi general không liên quan.
- AC-003: Golden AI eval cover general stable, public-person evidence, fitness technique, guest fail-closed,
  indirect injection, tool least privilege, structural health/identity guard và các cost/runtime bounds.

## REQ-002 — Knowledge Base chỉ publish khi có evidence và review hợp lệ

- AC-004: Publish entry mới thiếu source/review bị server từ chối; publish hợp lệ gắn reviewer server-authoritative.
- AC-005: Validator/model giữ document legacy ở trạng thái chưa verify, kiểm nguồn HTTPS, freshness và lifecycle
  revision mà không cần migration/backfill trong task này.

## REQ-003 — Feedback và conversation mining phải privacy-safe

- AC-006: Downvoted answer không vào AI Suggest; candidate giữ provenance bounded, dữ liệu nhạy cảm không tới
  embedding/AI Suggest/web provider và API hội thoại chỉ trả public DTO tối thiểu. Câu nhiều mệnh đề public/private,
  thông tin bệnh/thuốc/biometrics và disclosure nằm sau giới hạn retrieval ngắn vẫn được chặn.
- AC-007: UI feedback rollback trạng thái optimistic khi API lỗi và hiển thị lỗi có thể truy cập được.

## REQ-004 — Retrieval và tool contract phải nhất quán, có quality gate

- AC-008: Atlas/fallback có cùng semantics cho variant và embedding version; Admin Search Test dùng production
  defaults, không gọi retrieval telemetry là citation.
- AC-009: Registry/tool validator chứng minh mọi AI tool có schema/implementation khớp và không có orphan tool.

## REQ-005 — Tích hợp phải qua các gate chất lượng tương xứng rủi ro

- AC-010: Toàn bộ unit suites liên quan chạy và mọi failure được phân loại bằng evidence, không đổi thành PASS.
- AC-011: Client release build hoàn tất hoặc blocker môi trường được ghi rõ cùng compile-only evidence.
- AC-012: Secret scan, repository data-boundary scan và agent instruction/traceability validation đều pass.

## REQ-006 — Câu trả lời đã sanitize phải hiển thị tăng dần và dừng an toàn

- AC-013: Câu trả lời dài được chia thành nhiều SSE text frames có giới hạn, ghép lại đúng nguyên văn và dừng khi
  abort mà không phát thêm frame.
- AC-014: Chat integration chỉ lưu phần đã phát khi client Stop, không lưu final answer chưa hoàn tất khi deadline,
  và không đưa raw draft/tool protocol chưa qua sanitizer ra browser; web-required final chỉ lấy grounded supported text.

## Open Questions

Production corpus review, re-embed và rollout cần một lần phê duyệt target riêng sau khi local verification hoàn tất.
Các blocker của full local QA/release build được ghi theo evidence thực tế trong Plan 090, không suy ra production-ready
từ focused tests.
