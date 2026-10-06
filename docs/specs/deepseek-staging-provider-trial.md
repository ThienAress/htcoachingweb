# Spec: Thử DeepSeek cho HT Assistant trên staging

## Status

- APPROVED spec + Plan095/tasks by owner; 2026-10-06. Local implementation authorized.
- Complexity COMPLEX; risk HIGH: provider boundary, KB retrieval and release gates.
- Owner task: `01a10d36-267c-7880-920b-1e51ee0d8f65`.
- Đang implement local; chưa deploy, gọi API thật hoặc thay đổi cấu hình hosting.
- Owner xác nhận DeepSeek thay Gemini làm bộ não hội thoại, giữ lịch sử/ngữ cảnh
  và tools. Phương án trial giữ bounded LLM-based KB selection; không tự chuyển
  sang chatbot FAQ, vector model mới hoặc provider trả phí thứ ba.
- Implementation proposal: [Plan095](../plans/095-integrate-deepseek-staging-trial.md).

## Objective

Thử assistant hội thoại thật bằng DeepSeek trên UI staging; không chuyển thành
chatbot FAQ. Gemini được giữ để owner quyết định dùng lại sau thử nghiệm.
Trong phạm vi assistant của đợt thử, generation, KB retrieval và tool không được
gọi Gemini, kể cả đường fallback. Không thay đổi production.

## Assumptions và target

- Owner đã có DeepSeek API key và tự nhập key trong secret backend staging;
  không gửi key qua chat, không ghi key vào repository/frontend/log.
- Target database chỉ `htcoaching_staging`; backend Render staging
  `srv-d9g8em61a83c73b4l61g`. Origin/SHA/deployment identity phải được xác minh
  lại trước deploy/test; ID ghi trong spec không thay preflight.
- Chỉ dùng tài khoản/fixture và câu hỏi synthetic được chốt trước live test.
- Không suy quyền commit/push/merge từ quyền chỉnh code. Publish/deploy theo
  approval staging riêng, không bypass review/protection.

## Tech stack và current state

- Node `22.23.1`, Express 5, native fetch, Mongoose 9, Vitest, React/SSE.
- Baseline checkout: `.local-data/ai-progress-staging-20261003`, HEAD
  `c488118852988804362ff40ab9ad442d94fa3136`; root dirty không là nguồn product.
- `providers/index.js` chỉ có mock/Gemini; DeepSeek adapter chưa tồn tại.
- Contract internal provider: text chunks hoặc structured tool calls;
  controller vẫn enforce tool auth/ownership/schema và sanitize output.
- `embedding.service.js` gọi Gemini `embedContent`; không thể đổi generation
  rồi khẳng định đã loại Gemini khỏi KB retrieval.
- Startup production profile hiện yêu cầu Gemini dù service staging chạy
  `NODE_ENV=production`; cần profile thử staging riêng, không hạ gate main.
- `searchKnowledge.tool.js` dùng Google grounding qua Gemini. DeepSeek chat
  không tự thay capability web-grounding này.
- Chưa xác minh được một DeepSeek embedding API có documented contract.
  Không gửi request phỏng đoán tới `/embeddings` và không tạo vector bằng chat.

## REQ-001 — Provider thật, đảo ngược được

- AC-001: Adapter DeepSeek giữ contract SSE/tool/history và cancellation hiện có;
  dùng fixed HTTPS official origin `https://api.deepseek.com`, không theo redirect.
- AC-002: Trial đề xuất `deepseek-flash`, non-thinking; chọn explicit output/context
  bounds trong plan, không dùng max-token default rất lớn của upstream.
- AC-003: Gemini provider/files/key/vector/profile cũ không bị xóa hoặc ghi đè;
  không auto-fallback DeepSeek → Gemini/mock trong thử nghiệm.
- AC-004: Thiếu key, invalid model, HTTP error, truncated/empty/error stream
  không được lưu thành completed assistant. Metadata không chứa raw error/prompt/key.

## REQ-002 — KB semantic retrieval không gọi Gemini

Phương án đề xuất cho owner review: **bounded LLM-based retrieval** bằng DeepSeek,
không phải vector search và không phải đổi embedding model.

- AC-005: Candidates lấy từ KB public/published, review còn hiệu lực và source
  policy hiện có; cohort so sánh giữ eligibility embedding ready/version hiện tại.
  Privacy gate kiểm query và candidate (answer/tags/variants/source metadata)
  trước khi gửi. Chỉ projection nội dung cần thiết; không gửi embedding, private
  notes hoặc reviewer/actor information tới provider.
- AC-006: Query tiếp tục qua privacy/routing guard. Model chỉ chọn references
  thuộc candidate snapshot có giới hạn; output không là Mongo filter, URL hoặc quyền.
- AC-007: Backend validate references trong snapshot allowlist, deduplicate và
  giới hạn tối đa 3; lấy lại current document và kiểm review, status, freshness,
  revision/provenance trước dùng. Unknown/tampered/stale IDs fail closed.
- AC-008: Không gán confidence do model tự nói thành cosine similarity `0.75`;
  trace phải phân biệt retrieval method và coverage/truncation. Không lấy tín hiệu
  retrieval làm citation proof; giữ claim/source-binding policy độc lập.
- AC-009: Candidate recall/paraphrase/reviewed-variant/no-match là tiêu chí test.
  Corpus eligible phải phủ toàn bộ dưới candidate/payload cap đã duyệt, hoặc owner
  approve một cohort cụ thể cùng giới hạn recall. Nếu vượt cap thì STOP; không
  âm thầm dùng top-N popularity/keywords rồi claim semantic search toàn KB.
- Model không được tạo matchedQuestion, URL, source proof hoặc cosine score.
  Matching/claim binding vẫn do server enforce; chọn ID đúng chủ đề không đủ
  để gắn citation. Trial evidence lưu IDs + revisions + retrieval method;
  trace ID hiện tại không được mô tả là historical source reconstruction.
- AC-010: Không re-embed, migration, đổi index hoặc xóa nội dung KB. Trial được
  phép thêm subdocument observability additive trong `ChatConversation.answerTrace`
  để lưu method/coverage/counts và entry ID/rank/revision allowlist; không backfill
  conversation cũ. Usage counters có thể tăng như luồng assistant hiện có; live test
  phải ghi nhận.

Alternative: nếu owner yêu cầu vector search thật, cần chọn riêng embedding
provider/model hoặc self-host runtime và approve rollout/version/rollback trước code.
Không tự lựa chọn thêm dịch vụ trả phí hoặc tải model lớn lên Render.

## REQ-003 — Search, security và startup gates

- AC-011: Khi web_required cần tra cứu mới, trial không gọi Gemini hoặc coi model
  prior/KB cũ là bằng chứng mới. Trả unsupported-capability reason đúng contract;
  ghi riêng các case này, không đánh dấu live web-search PASS.
- AC-012: Chỉ profile staging với target/origins đã xác minh mới cho phép DeepSeek.
  Production config ngoài profile trial vẫn reject DeepSeek như hiện tại.
- AC-013: Giữ auth/CSRF/ownership/moderation/quota/rate-limit/deadline/tool bounds.
  Không thêm write tool, không thay tool permissions, không sửa frontend auth API.
- AC-014: Gemini meal scan/KB admin generation nằm ngoài thử assistant; không
  sử dụng các chức năng đó trong trial và không claim toàn hệ thống zero Gemini.
- AC-015: Metadata provider/model/usage/error phải đúng DeepSeek, không tính vào
  Gemini metrics. Không cần nới browser CSP để browser gọi trực tiếp provider.
- AC-016: Chat và Admin Search Test dùng cùng retrieval mode, không gọi Gemini
  âm thầm; UI không hiển thị rank/model confidence như `% match` của cosine.
  Trial selection có tối đa một provider call, abort/deadline chung với chat;
  không cộng thêm timeout/cap hoặc retry riêng không có budget.

## Cấu trúc file bị ảnh hưởng dự kiến

- `server/src/services/ai/providers/`: DeepSeek adapter, factory và focused tests.
- `server/src/services/ai/`: retrieval runtime/service, trace/model mapping và tests.
- `server/src/services/ai/systemPrompt.js`: nhãn KB reference đúng retrieval method,
  không biến rank LLM thành cosine hoặc thay đổi instruction/citation policy.
- `server/src/controllers/ai.controller.js`: provider metadata/retrieval consumers.
- `server/src/controllers/knowledgeBase.controller.js`: Admin search consumer.
- `client/src/pages/admin/KnowledgeBase.jsx`: nhãn retrieval method, không fake score.
- `server/src/services/ai/tools/searchKnowledge.tool.js`: capability block trial.
- `server/src/services/ai/tools/toolEngine.js`: allowlist capability diagnostic
  metadata; không thay quyền tool hoặc nhận metadata tùy ý từ model.
- `server/src/config/productionReadiness.js`: exact staging trial validation/tests.
- `server/src/observability/`: provider-independent usage metadata/tests nếu cần.
- `e2e/`: UI trial verification; không sửa selectors/oracle chỉ để PASS.
- `docs/operations/`: secret configuration, trial scope/rollback/evidence runbook.
- File ownership/exact changes phải được khóa trong plan sau khi spec approved.

## Code style và commands

Giữ service/controller layering; native fetch như adapter hiện có; không thêm SDK
chỉ để đổi API. Không refactor các file lớn hoặc lấy product edits từ root dirty.

- Server verification: `npm run test:unit:server`.
- Client release build: `npm run build --prefix client`.
- AI eval: `npm run test:ai-eval`.
- Tool validation: `node .agents/scripts/validate-tools.mjs`.
- Security: `npm run security:secrets`, `npm run security:data-boundaries`.
- Docs/instructions: `npm run security:docs-privacy`, `npm run agents:validate`.
- E2E: `npm run test:e2e` chỉ khi servers/isolated fixture sẵn sàng.
- Nếu sửa nhãn Admin UI: client lint và UI regression gate hiện có trước manual UI.
- Full QA/evidence theo skill `qa`; không dùng unit mocks làm bằng chứng UI live.

## Testing strategy và success criteria

- RED/GREEN qua provider public generator, HTTP/SSE/history, retrieval public seam.
- Test fragmented UTF-8/SSE, keep-alive, tool argument chunks, bad JSON, abort,
  timeout, HTTP429/5xx, stream error, length/content-filter and no replay after output.
- Negative tests: private/stale/unreviewed KB, unknown selection, paraphrase recall,
  reviewed variants, edits/archive giữa select và re-fetch, source misbinding,
  provider failure, query/candidate privacy và candidate/payload caps.
- Intercept outbound requests để assert **zero Gemini calls** trong assistant trial.
- Sau trusted CI/review + exact staging deploy + owner nhập key: real UI chat,
  follow-up context, KB/source link, read-only tool, Stop/Retry/history.
- Live budget, accounts/questions và cleanup phải được chốt trước call trả phí.
- Ghi PASS/FAIL/NOT RUN và latency từng case; UI thử thành công không thay thế
  canonical AC009/Plan092 certification hoặc production GO.
- Rollback trial là khôi phục config đã snapshot và redeploy Gemini; vector KB cũ
  vẫn còn, không rollback data bằng delete rộng.

## Boundaries và open questions

- Always: chỉ staging, synthetic data, preserve user edits, independent security
  review cho provider boundary, exact SHA/provider/health preflight trước live.
- Ask first: LLM-based retrieval thay vector search, thêm embedding provider,
  paid live budget, Git publish/deploy, schema/data rewrite hoặc production change.
- Never: gửi key/raw chats vào logs; tự mua/nạp tiền; bypass review; nới deadline,
  quota/oracle; giữ partial output như completed; test loop vô hạn.
- Owner còn cần chốt: ngân sách/số câu hỏi live,
  tài khoản/fixture và phạm vi publish staging. Không coi approval functional
  direction là approval số tiền, Git writes hoặc deployment.
- Spec + plan/tasks/cap local approved theo gate `feature-spec`; tiến hành implementation local.

## Official API references

- [DeepSeek Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/).
- [Models and pricing](https://api-docs.deepseek.com/quick_start/pricing/?tab=case-studies).
- [Tool Calls](https://api-docs.deepseek.com/guides/tool_calls/).
- [Rate limit and SSE keep-alive](https://api-docs.deepseek.com/quick_start/rate_limit/).
