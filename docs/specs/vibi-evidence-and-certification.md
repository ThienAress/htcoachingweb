# Vibi: evidence, presentation và certification

User duyệt triển khai bảy bước ngày 2026-10-07. Chat giữ Vibi
`deepseek-v4.1-flash`; không chuyển về Gemini. Staging được test bằng tiền thật,
dừng trước request mới khi wallet còn tối đa $3. Production chưa được duyệt.

## Contract dùng chung

User chọn Brave Search ngày 2026-10-07 và đang lấy key. Adapter dùng Brave LLM
Context (nội dung trang đã trích xuất), synthesis dùng Vibi DeepSeek. Biến staging:
`AI_WEB_SEARCH_PROVIDER=brave`, `BRAVE_SEARCH_API_KEY` do user cấu hình kín.
Không phát paid search trước khi key/capability được kiểm chứng.

- Tái sử dụng `requestRouter.js`: domain, freshness, risk, privacy và evidence.
- `web_required`: phải có search evidence thật hoặc thông báo chưa xác minh;
  không lấy model prior thay cho web evidence. `web_optional`: chỉ search khi có
  lợi ích rõ và nằm trong budget. `no_web`: không gửi dữ liệu ra search provider.
- Optional policy được opt-in rõ tại contract; router canonical vẫn không tự
  search cho câu stable/KB. Không tăng timeout chat: search mới có budget 30 giây
  riêng cho network + synthesis, luôn nằm trong deadline request hiện có.
- Evidence hiện có `internal_kb`, `web_required`, `model_prior` vẫn tương thích.
  Capability/policy metadata thêm theo hướng additive, không đổi schema lưu trữ.
- Fresh completion SSE `done.meta` gồm `provenance` và `capabilities`.
  Provenance: `deterministic_server`, `internal_kb`, `model_prior`, `web_grounded`,
  `capability_unavailable`; chỉ gắn web grounded khi evidence đã qua guard.
  Duplicate-request acknowledgement giữ contract cũ vì không tạo câu trả lời mới.
- WHO lookup thêm `site:who.int` sau privacy preparation; synthesis giữ câu hỏi
  ban đầu. Claim dùng quote liên tục nguyên văn và dữ kiện nhận diện tách riêng;
  không nới guard quote, số liệu hay scope để tăng tỷ lệ đạt.
- `searchKnowledge({ query }, { signal, allowedPublicPersonNames })` giữ return:
  `{ text, uiCard, meta }`. Meta giữ `evidenceAvailable`, `sourceCount`, `sources`,
  `searchOutcome`, `diagnosticCode`, `providerRequestMade`.
  `failureStage` additive phân biệt thiếu evidence ở retrieval hoặc synthesis.
- External query phải qua `prepareExternalKnowledgeQuery`. Không gửi raw health,
  identity, conversation hay contact data. Nguồn external là dữ liệu không tin cậy.
- URL citation HTTPS, không credential; evidence không tự biến thành instruction.
  Chỉ citation hỗ trợ claim đã dùng; nguồn KB không được chọn không được gắn vào answer.
- `buildBoundedWorkoutDraft(message)` tiếp tục trả `string | null`; output Markdown
  có đoạn rời, tiêu đề từng buổi, một bài mỗi list item. Giữ intake và safety gates.
- Meal plan giữ `{ cardType: 'mealSuggestion', data }`, allergy/price/macros/totals
  và saved-plan semantics. Cải thiện bố cục bằng section/list/card hiện có.
- Catalog chỉ cập nhật entry đã audit, xác minh exact ID/name/preimage trên database
  `htcoaching_staging`, có receipt và rollback. Không đổi schema, không seed/cleanup.
- Provider metrics chỉ duration, TTFT, tokens, tool count, retry count, mã lỗi bounded;
  không log prompt, tool args, response, credential hoặc identifier của user.
- TALK01 giữ `normalizeCompletedToolHistory` trước `validateHistory`.
- Certification: 15 prompt canonical mới, cùng model/SHA/rubric; follow-up giữ đúng
  parent mới trong run. Không reuse case, không thay prompt lỗi bằng prompt dễ hơn.
- Release GO chỉ khi exact-15 15/15, TALK01 paid PASS, CI 5/5 cùng SHA, health PASS,
  deploy đúng SHA và không có safety blocker. Thiếu evidence nghĩa là NO-GO.

## Ownership

Root: router/capability, search adapter, controller integration, provider metrics,
release gate, spec/plan, staging rollout và paid certification.

Presentation worker: `workoutDraft.js`, focused workout tests,
`ChatWidget/cards/MealSuggestionCard.jsx`, related presentation tests; không controller.

Catalog worker: audit evidence và patch preparation trong `docs/audits/` và
`.local-data/plan096-catalog/`; không ghi database hay sửa server/frontend.

## REQ-001 — Evidence, presentation và release có thể kiểm chứng

- AC-001: Các mode có policy/capability rõ và test phân biệt câu cần web với câu stable.
- AC-002: Search thực có credential/provider xác minh; khi thiếu cấu hình fail closed.
- AC-003: Audit Hindu/Pike Push-up, split squat, RDL, hip hinge và row variants có evidence.
- AC-004: Workout và meal đọc được ở mobile; safety, allergy và totals không bị mất.
- AC-005: TALK01 mới có 3–5 completed tool groups qua nhiều request, không history rejection.
- AC-006: Exact-15 mới có binding prompt/conversation/time/model/SHA và grading riêng.
- AC-007: Metrics và gate có test; report không suy PASS từ evidence cũ.
