# Spec: Đo độ bám câu hỏi và thử JEV tại KB selector

## Objective và trạng thái

Đề xuất ngày 2026-10-12, **chờ duyệt; chưa cho phép implementation hoặc rollout**.
Giúp HT Assistant trả lời đúng yêu cầu hiện tại, giữ ràng buộc qua các lượt và dùng đúng bằng chứng.
Giữ DeepSeek + Brave; chỉ thử JEV nếu một phép so sánh có kiểm soát chứng minh được lợi ích.
Không dùng việc tích hợp JEV làm tiêu chí thành công. Ý kiến chuyên gia/video chỉ là nguồn tham khảo.

Đây là phần bổ sung về đo lường và pilot, không thay thế các spec canonical tại snapshot đã xác minh:

- [HT Assistant reliability][reliability].
- [Fitness-first và knowledge quality][knowledge].
- [Vibi evidence/certification][evidence].

[reliability]: https://github.com/ThienAress/htcoachingweb/blob/af1a6cfc9191897d92bb51dc312029882259ed89/docs/specs/ht-assistant-reliability.md
[knowledge]: https://github.com/ThienAress/htcoachingweb/blob/af1a6cfc9191897d92bb51dc312029882259ed89/docs/specs/fitness-first-ai-and-knowledge-quality.md
[evidence]: https://github.com/ThienAress/htcoachingweb/blob/af1a6cfc9191897d92bb51dc312029882259ed89/docs/specs/vibi-evidence-and-certification.md

## Tech stack và baseline

Express 5, Mongoose 9, Node 22.23.1 tại deployed SHA; UI React hiện có không đổi contract.
Snapshot Render ngày 2026-10-12 khoảng 12:08–12:11 ICT ghi nhận production/staging cùng cấu hình:
DeepSeek `deepseek-flash`, profile `official`, Brave và KB `llm_selection`.
Deployed SHA là `af1a6cfc9191897d92bb51dc312029882259ed89`; phải kiểm tra lại trước khi làm.
Checkout local `b102572c626b1b79c290a786c96a51ebfc28c242` cũ và nhiều thay đổi chưa commit.
Không lấy local defaults hay ref mới hơn làm bằng chứng deployment.

## Requirements và acceptance criteria

### REQ-001 — Khóa nguồn thực thi và ranh giới dữ liệu

- AC-001: Có manifest ghi SHA, deploy identity, thời điểm, cấu hình không nhạy cảm và Node version;
  workspace thực thi được user chọn/duyệt, giữ nguyên thay đổi cũ. Khi nguồn drift phải kiểm tra lại.
- AC-002: Có phê duyệt dataset, tài khoản/host thử nghiệm, hạn mức tiền/số calls và lưu giữ evidence
  trước mọi capture tính phí hoặc ghi staging; mặc định không xuất hội thoại/dữ liệu sức khỏe thật.

### REQ-002 — Đo câu trả lời thật, tách khỏi fixture

- AC-003: Dataset có version và tách development/holdout trước tuning; bao phủ hỏi trực tiếp, follow-up,
  đổi ý, sửa một phần, giữ ràng buộc, thiếu bằng chứng, nguồn web và safety/privacy adversarial cases.
- AC-004: Baseline ghi rõ `fixture` hoặc `provider_capture`, model/prompt/KB revision và từng lỗi;
  có rubric được người review chấm, metric theo nhóm, p50/p95, timeout và chi phí toàn câu trả lời.
  `test:ai-eval` pass không được đổi nhãn thành bằng chứng chất lượng live.

### REQ-003 — Sửa khoảng trống đo được trước khi đổi selector

- AC-005: Mỗi fix bắt đầu từ case tái hiện được, có regression test và so sánh trước/sau trên holdout;
  chỉ sửa lớp gây lỗi, không xây lại router, memory, scope guard hay provenance đã tồn tại.
- AC-006: Bản DeepSeek + Brave cải thiện được phép phát hành độc lập sau QA/staging/release approval;
  không phụ thuộc việc mua/tích hợp JEV. Nếu chưa đạt mục tiêu, báo chưa đạt thay vì chuyển model để né lỗi.

### REQ-004 — Pilot JEV bị giới hạn tại lựa chọn KB evidence

- AC-007: Nếu tiếp tục, xác minh vendor/API/version, retention, vùng xử lý và chi phí trước calls;
  so sánh cùng query/candidates/revision với DeepSeek selector trên dữ liệu synthetic/public được duyệt.
  Nếu không có quyền hoặc không đủ lợi ích, ghi `no_go`/`inconclusive`, giữ JEV tắt.
- AC-008: Nếu triển khai pilot, adapter chỉ trả refs được phép hoặc abstain; giữ eligibility/privacy filters,
  kiểm tra revision sau đọc lại và metadata `{ results, retrieval }` cho consumer hiện tại.
  Lỗi/timeout khác "không có bằng chứng"; fallback dùng budget còn lại. Không làm pilot thì ghi không áp dụng.

### REQ-005 — Shadow staging không thay đổi đáp án người dùng

- AC-009: Nếu pilot qua gate và được duyệt, shadow chạy trên synthetic/allowlisted low-risk sessions,
  có giới hạn concurrency/calls/tiền, cancellation và telemetry không chứa raw payload;
  đáp án vẫn do baseline tạo. Nhánh không JEV ghi rõ bước này không áp dụng.
- AC-010: Timeout, sai schema/ref, prompt injection, stale corpus, hủy request và hết ngân sách
  đều có evidence kiểm thử; kill switch ngăn calls mới, không để retry/queue chạy vô hạn.
  Không bỏ qua health/privacy/ownership guards để tăng sample; nhánh không JEV ghi `not_applicable`.

### REQ-006 — Canary chỉ mở sau approval riêng

- AC-011: Nếu chọn JEV, cohort giới hạn ở yêu cầu KB low-risk đủ điều kiện; DeepSeek vẫn sinh đáp án,
  Brave vẫn xử lý web, không đổi auth/quota/tool permission/SSE/card contract.
  Tỷ lệ tăng mẫu và ngân sách phải được duyệt; nhánh không JEV không mở canary JEV.
- AC-012: Có baseline control cùng thời kỳ, gate chất lượng/chi phí/độ trễ và rollback đã diễn tập;
  thiếu mẫu hoặc có regression quan trọng thì không tăng rollout. Nhánh không JEV giữ selector cũ.

### REQ-007 — Đóng việc bằng kết quả, không bằng tích hợp công nghệ

- AC-013: Kết luận `baseline_only` hoặc `jev_adopted` có evidence theo đúng SHA/config/dataset,
  ghi giới hạn và phần chưa đạt; khi cần deployment thì có approval và post-deploy verification.
- AC-014: Runbook có owner, kill switch, fallback, alert/retention và điều kiện benchmark lại;
  cập nhật plan/state/traceability. Không tuyên bố live, hoàn thành hay an toàn tuyệt đối từ test local.

## Rubric và gate đề xuất — phải chốt trước thí nghiệm

Một câu trả lời chỉ đạt adherence khi đúng yêu cầu mới nhất, giữ ràng buộc còn hiệu lực,
không tự mở rộng phạm vi và dùng bằng chứng phù hợp hoặc nói rõ thiếu dữ liệu.
Đổi ý phải ghi đè ràng buộc cũ tương ứng; nội dung KB/web không được trở thành chỉ thị hệ thống.
Chấm riêng relevance, constraint retention, scope preservation và evidence support.
Người review xem đáp án ẩn tên phương án; LLM judge nếu có chỉ là tín hiệu phụ và cần duyệt chi phí.

- Khởi đầu đề xuất 100 hội thoại synthetic/public, 60 development + 40 holdout, mỗi hội thoại 2–6 lượt.
  Kèm suite critical riêng; giữ nguyên split, không tuning bằng holdout rồi tiếp tục gọi nó là holdout.
- Với nhóm lỗi đã chọn: mục tiêu cải thiện adherence ít nhất 5 điểm phần trăm; không thêm critical failure.
  Nếu baseline đã sát trần, chốt mục tiêu khác trước tuning, không đổi gate sau khi thấy kết quả.
- JEV phải qua một trong hai hướng: tăng chất lượng có ý nghĩa với p95/chi phí không tăng quá 10%,
  hoặc giảm p95 hay chi phí ít nhất 20% với adherence không kém quá 2 điểm phần trăm.
  Metric còn lại không tăng quá 10%; đo toàn request, gồm fallback và retries, không chỉ selector.
- Báo khoảng bất định 95% theo hội thoại; lặp paired subset để đo biến thiên.
  Quality lane cần khoảng cải thiện nằm trên 0; efficiency lane cần cận dưới trên -2 điểm phần trăm.
  Mẫu ban đầu không đủ kết luận thì giữ `inconclusive`; chỉ mở rộng trong budget đã duyệt.
- Không có critical regression trong suite cố định là gate bắt buộc, không phải bảo đảm an toàn y khoa.
  Độ chính xác refs/abstain không thay thế kiểm tra adherence của câu trả lời cuối.

## Contract dự kiến của pilot, không phải API JEV đã xác minh

Backend adapter nhận query đã qua privacy gate, candidates đủ điều kiện, corpus revision,
deadline tuyệt đối và AbortSignal. Chỉ gửi trường tối thiểu; không gửi user ID hay toàn bộ history.
Kết quả nội bộ: `status: selected | no_match | error`, `refs` tối đa 3 và reason code hữu hạn.
`selected` cần refs có thật/không trùng; `no_match` là abstain hợp lệ; `error` có thể fallback.
Backend đọc lại refs và kiểm tra quyền, trạng thái, revision trước dùng nội dung để trả lời.
Không truyền raw output của vendor vào prompt hoặc SSE; giữ retrieval metadata contract hiện hành.

Giữ tối đa 64 candidates/64 KiB như baseline cho vòng đầu; không âm thầm truncate khi vượt cap.
Tổng KB selection chat vẫn trong 12 giây, không cấp thêm 12 giây riêng cho fallback.
Hết budget đi theo failure/missing-evidence policy hiện tại; không tự thay đổi high-risk policy.
Confidence của JEV không được dùng thay safety gate hoặc coi là xác suất trả lời đúng.
Đối chiếu [tài liệu chính thức](https://docs.typesafe.ai/introduction) và
[confidence](https://docs.typesafe.ai/confidence) tại gate vendor; không lấy snippet trong attachment làm API contract.

## File scope, style và commands

File map, commands đang tồn tại và các CLI **mới dự kiến** nằm trong
[Plan 110](../plans/110-improve-ai-adherence-and-gate-jev-pilot.md).
Tái sử dụng HTTP/capture, semantic evaluator và release evidence hiện có; chỉ thêm phần còn thiếu.
Giữ MVC/service layering, `safeLog`, module mới khoảng dưới 300 dòng; không refactor controller lớn ngoài scope.
Không đổi tool registry/schema, moderation hoặc system prompt nếu chưa có case và impact map chứng minh cần thiết.

## Testing strategy và boundaries

Contract/fixture offline → regression theo case → provider capture được duyệt → staging → release gates.
QA sở hữu chạy suite và lưu evidence gắn SHA/config; ai-check và impact-check xác minh các consumer AI.
Build/client/E2E chỉ mở rộng theo impact hoặc release gate hiện hành, không suy pass từ việc không đổi UI.
Không gọi provider, tạo tài khoản, export data, deploy, commit/push hay đổi model production trong lượt viết spec.
Không thêm vector DB, memory store, reranker toàn hệ thống hoặc JEV router luôn bật.
Backend giữ quyền quyết định auth, quota, ownership, tính toán và health safety.

## Những quyết định cần user duyệt theo từng gate

1. Workspace/base SHA và mục tiêu ưu tiên: độ bám câu hỏi trước hay SLA cụ thể nếu đã có.
2. Dataset/rubric và hạn mức số calls, tiền, môi trường, tài khoản, thời gian giữ evidence.
3. Có làm pilot JEV sau bản baseline cải thiện hay kết thúc `baseline_only`.
4. Approval độc lập cho staging shadow và production canary/deployment; không suy từ việc duyệt roadmap.
