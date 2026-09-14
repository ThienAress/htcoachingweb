# Plan 090: Biến HT Assistant thành fitness-first và grounding Knowledge Base bằng evidence

> **Hướng dẫn thực thi**: Thực hiện từng behavior slice, chạy focused verification trước khi chuyển bước.
> Không chạy migration, re-embed, deploy hoặc ghi staging/production trong plan này.
>
> **Drift check**: Snapshot review được tích hợp trên `origin/staging` tại
> `82a2551c9cde8327a4a3cbf26fd2e056e20a1f40`. Nếu các hotspot AI/KB
> có thay đổi không thuộc Plan 090, dừng file đó và reconcile ownership trước khi sửa.
> `origin/staging` sau đó tiến tới `efa22d987d717b50f6ecb100c4dcff4128623e22` bằng hai commit chỉ chạm
> tài liệu backup production; không overlap với file Plan 090 tại pre-PR drift check.

## Status

- **Priority**: P1
- **Complexity**: COMPLEX
- **Effort**: L
- **Risk**: HIGH — health privacy, AI misinformation và additive Mongoose schema
- **Depends on**: 031, 052
- **Category**: feature | security | data | tests
- **Planned at**: 2026-09-12
- **Lifecycle**: BLOCKED
- **Verification**: STAGING
- **Rollout**: LIVE
- **Owner**: root
- **Updated at**: 2026-09-15

## Why This Matters

Prompt hiện từ chối general knowledge dù request vẫn tốn quota, KB chạy cho mọi message và nhãn “verified” chỉ
chứng minh vector đã sẵn sàng. Slice này dùng routing/evidence/feedback để Flash Lite trả lời đáng tin hơn mà không
tăng model cost mặc định, đồng thời ngăn hội thoại sức khỏe cá nhân bị tái chế thành global knowledge.

## Baseline at Planning

- `server/src/services/ai/systemPrompt.js:247-283` khóa fitness-only và dùng Lisa làm ví dụ hỏi lại.
- `server/src/controllers/ai.controller.js:415-423` chạy KB search top-3/0.75 cho mọi message.
- `server/src/models/KnowledgeEntry.js:10-155` có vector lifecycle nhưng thiếu source/reviewer/freshness gate.
- `server/src/controllers/knowledgeBase.controller.js:595-766` gửi Q&A conversation thô vào AI Suggest, bỏ feedback
  và làm mất message provenance.
- `server/src/services/ai/embedding.service.js:229-301` chỉ dùng variant trong bounded fallback, không phải Atlas path.
- `client/src/pages/admin/KnowledgeBase.jsx:572-797` có Suggest/Conversation/Search Test nhưng chưa có review/evidence
  workflow và dùng threshold 0.60 khác production.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused server | `npx -y node@22.23.1 server/node_modules/vitest/vitest.mjs run server/src/services/ai/__tests__/requestRouter.test.js server/src/services/ai/__tests__/knowledgePrivacy.test.js server/src/services/ai/__tests__/personalHealthData.test.js server/src/services/ai/tools/__tests__/searchKnowledge.tool.test.js server/src/controllers/__tests__/aiFeedbackTrace.integration.test.js` | exit 0 |
| Focused client | `npm run test:unit:client` | exit 0 |
| AI eval | `npx -y node@22.23.1 scripts/run-ai-evals.mjs` | exit 0 |
| AI tool gate | `npx -y node@22.23.1 .agents/scripts/validate-tools.mjs` | exit 0 |
| Unit suites | `npm run test:unit` | exit 0 |
| Client lint | `npm run lint --prefix client` | exit 0 |
| Client build | `npm run build --prefix client` | exit 0 |
| UI regression | `npm run ui:audit -- --baseline scripts/ui-audit/baseline.json --fail-on-new-high` | exit 0 |
| Security | `npm run security:secrets` and `npm run security:data-boundaries` | each exits 0 |
| Agent docs | `npm run agents:validate` | exit 0 |
| Diff hygiene | `git diff --check` | exit 0 |

Các lệnh chạy bằng Node `22.23.1` của project; khi shell mặc định dùng Node khác, dùng bản Node 22
cho cả các npm script. Test dùng fixture/mocks; không gọi provider production.

## Scope

**In scope**:

- AI routing/prompt/search tool and their eval/unit tests.
- `KnowledgeEntry` and `ChatConversation` additive evidence/review fields.
- Knowledge Base validators/controllers/routes, retrieval service and focused tests.
- Migration compatibility helper/tests chỉ để chứng minh legacy behavior local; không execute migration.
- Admin Knowledge Base UI/service and Chat feedback rollback behavior.
- SSE response framing và client stream queue cho câu trả lời đã sanitize.
- Request telemetry/logger correlation-ID privacy hardening và smoke/test contract liên quan.
- Spec, plan, traceability, generated project inventory and local QA evidence.

**Out of scope**:

- Model/provider default, commercial quota values, auth/CSRF implementation.
- Production data audit, backfill/re-embed/index apply, deploy or live provider calls.
- General-purpose Knowledge Base corpus, autonomous publishing or AI write tools.

## Steps

### Step 1: Route general-safe và evidence-required requests đúng cách

Thêm deterministic router (`requestRouter.js`), đưa bounded decision vào `systemPrompt.js`, bỏ fitness-only refusal.
`ai.controller.js` chỉ cho `search_knowledge` dùng standalone `retrievalQuery` canonical đã qua `prepareExternalKnowledgeQuery`;
model-generated args không được chạy/lưu, query private không expose tool và routing reason ghi `external_privacy_blocked`.
`searchKnowledge.tool.js` chỉ lấy đoạn `groundingSupports` liên kết HTTPS `groundingChunks`. `web_required` trả
trực tiếp đoạn supported sau sanitizer trong một chat-model turn, không viết lại rồi gắn URL vào claim khác.
Link tự sinh trong supported text bị neutralize; chỉ link từ chunk HTTPS được dựng thành nguồn.
KB chỉ chạy với fitness/HT/internal intent. Guest giữ web tool disabled; không evidence thì fail-closed.

**Behavior**: Lisa được trả lời trực tiếp; Ronaldo routine bắt buộc evidence; squat và vocabulary chuyên môn
(`hypertrophy`, `deload`, `mesocycle`, `1RM`, `VO2 max`, `periodization`, `mobility`) đi qua internal fitness evidence.

**Verify**: `npx -y node@22.23.1 server/node_modules/vitest/vitest.mjs run server/src/services/ai/__tests__/requestRouter.test.js server/src/services/ai/__tests__/systemPrompt.test.js server/src/services/ai/tools/__tests__/searchKnowledge.tool.test.js server/src/controllers/__tests__/aiFeedbackTrace.integration.test.js` và `npx -y node@22.23.1 scripts/run-ai-evals.mjs` → exit 0. Controller test xác nhận fetch/persist canonical query, no web tool với private query, chỉ supported text và một chat-model turn.

### Step 2: Publish Knowledge Entry bằng source và review server-authoritative

Thêm metadata additive, validator nguồn HTTPS/evidence/freshness, publish transition do server gắn reviewer và API/UI
cho admin nhập evidence. Document cũ được map thành legacy, không bị xóa hoặc tự nâng trust.

**Behavior**: entry thiếu evidence ở draft được lưu; publish thiếu evidence bị từ chối; source-backed entry publish được.

**Verify**: `npx -y node@22.23.1 server/node_modules/vitest/vitest.mjs run server/src/utils/__tests__/knowledgeBase.test.js server/src/controllers/__tests__/knowledgeBaseEvidence.routes.integration.test.js server/src/migrations/__tests__/20260719-phase2-ai-kb-integrity.test.js` và `npm run test:unit:client` → exit 0. Migration chỉ test local, không execute lên database thật.

### Step 3: Khép privacy-safe conversation suggestion và feedback review

Loại downvote, filter/redact PII/health trước embedding, AI Suggest và web provider; kiểm cả structural
condition/medication/biometrics và private-name/composite public-person queries trong safety window dài hơn retrieval.
Emergency/self-harm trả lời tĩnh, không gọi provider. Giữ message provenance, lưu bounded answer trace và thêm admin
queue xử lý `pending → resolved|dismissed`. Thu hẹp projection conversation; feedback UI rollback khi POST lỗi.

**Behavior**: raw sensitive pair không rời server, downvote không được suggest, admin xử lý review có CSRF và audit
metadata, trace chỉ chứa IDs/enums/version.

**Verify**: `npx -y node@22.23.1 server/node_modules/vitest/vitest.mjs run server/src/services/ai/__tests__/knowledgePrivacy.test.js server/src/services/ai/__tests__/personalHealthData.test.js server/src/controllers/__tests__/aiFeedbackTrace.integration.test.js server/src/controllers/__tests__/knowledgeBaseEvidence.routes.integration.test.js` và `npm run test:unit:client` → exit 0.

### Step 4: Đồng bộ retrieval và tạo quality gate

Đồng bộ semantics variants/version giữa Atlas và fallback bằng retrieval document records hoặc strategy tương đương,
version hóa embedding profile mà không tự rollout. Search Test mặc định production parity. Thêm golden corpus/router
tests cho hit/no-hit/variant/public-person và metrics không gọi retrieval count là citation.

**Behavior**: query variant trả đúng entry trong cả paths; profile cũ/mới không bị trộn; admin thấy đúng mode production.

**Verify**: `npx -y node@22.23.1 server/node_modules/vitest/vitest.mjs run server/src/services/ai/__tests__/embedding.service.test.js` và `npm run test:unit:client` và `npx -y node@22.23.1 scripts/run-ai-evals.mjs` → exit 0.

### Step 5: Hiển thị câu trả lời tăng dần mà không lộ raw draft

Sau khi model hoàn tất một response không còn tool call và output sanitizer chấp nhận, chia nội dung thành nhiều SSE
text frames có giới hạn thời gian. Client tiếp tục dùng stream queue hiện có để render tăng dần. Không stream trực tiếp
raw provider chunks vì provider có thể phát draft trước function call hoặc protocol text cần loại bỏ.

**Behavior**: câu trả lời dài không xuất hiện nguyên khối; các frames ghép lại đúng nội dung cuối và abort dừng sạch.
Provider failure chỉ cho retry trực tiếp khi server đã rollback turn lỗi; request key của guest được namespace theo owner
và vẫn dual-read raw key cũ để hai guest không va idempotency hoặc mất khả năng retry hội thoại legacy.

**Verify**: `npx -y node@22.23.1 server/node_modules/vitest/vitest.mjs run server/src/services/ai/__tests__/responseStreamer.test.js server/src/controllers/__tests__/aiFeedbackTrace.integration.test.js` và `npm run test:unit:client` → exit 0. Chứng minh Stop chỉ persist phần đã phát, không lộ draft/tool protocol.

### Step 6: Re-trace, review độc lập và QA tích hợp

Trace lại model → controller/service → route → client, chạy code review theo Standards/Contract/Security rồi cleanup.
Chạy full unit, client build, AI/security/agent gates; ghi rõ E2E/provider/live verification chưa chạy.

**Behavior**: code local sẵn sàng review, không secret/debug code và không mutation môi trường ngoài local.

**Verify**: toàn bộ command trong Commands You Will Need có evidence; `git diff --check` sạch.

## Test Plan

- Server: router taxonomy, prompt contract, canonical privacy-vetted web query, support-mapped grounded HTTPS text,
  one-turn final/no source laundering, provider-authored link neutralization, web fail-closed, source-required publish,
  legacy compatibility, structural
  health/identity guard ở cả embedding/AI Suggest/web, suggestion feedback filter/provenance, answer trace/review
  transition, variant/version retrieval.
- Client: evidence form payload/error states, production Search Test contract, feedback optimistic rollback và admin review.
- Integration: admin role + CSRF cho mutation, response projections và existing chat/quota behavior không đổi.
- Không gọi Gemini/Atlas production; dùng fixtures/mocks synthetic và không log raw prompt.

## Verification Evidence — 2026-09-13

| Gate | Evidence | Result / limitation |
|---|---|---|
| Privacy, structural health, router và KB evidence focused suite | Node 22 Vitest, 7 files: `requestRouter`, `knowledgePrivacy`, `personalHealthData`, `searchKnowledge.tool`, `aiFeedbackTrace`, `knowledgeBaseEvidence.routes`, `knowledgeBase` | 931/931 PASS trước pattern diet cuối; controller được chạy lại 57/57 PASS sau pattern. Không thay thế full server suite. |
| Grounding source boundary | `searchKnowledge.tool.test.js` với synthetic provider fixtures | 54/54 PASS sau khi hiển thị hostname thật cạnh publisher title; integration liên quan trước đó 87/87 PASS nhưng chưa chạy lại riêng sau patch nhãn. Không phải live Gemini verification. |
| Router + controller compound regression | Node 22 Vitest `requestRouter.test.js aiFeedbackTrace.integration.test.js`, sau đó controller riêng | 285/285 PASS trước diet preference patch; controller cuối 57/57 PASS. Chỉ mở TDEE trước, dùng macro canonical theo Low/Moderate/High-carb explicit, guard follow-up TDEE cũ khi có số đo/calo mới; không mở meal khi TDEE invalid. |
| AI eval | `npx -y node@22.23.1 scripts/run-ai-evals.mjs` | 49/49 PASS với corpus `2026-09-retrieval-v14`; thêm office-holder, live market, event result và historical negative control; không gọi provider thật. |
| Tool registry | `npx -y node@22.23.1 .agents/scripts/validate-tools.mjs` | 11/11 PASS. |
| Client unit | Node 22.23.1 Vitest trên snapshot review dựa staging | Focused Plan 090 cuối: 15/15 files, 93/93 PASS. Một lượt chạy tải cao ban đầu có 1 timing failure ở reconcile-before-edit; file riêng 20/20 và full focused rerun 93/93 PASS. Full suite gần nhất: 169/170 files và 815/816 tests PASS; một test staging có sẵn `selfManagedDashboard.test.js` fail vì raw-source assertion phụ thuộc LF trong khi Windows checkout dùng CRLF. Hai file liên quan không đổi so với `origin/staging`. |
| Guest retry/idempotency focused | `aiGuestAccess.integration.test.js` | 17/17 PASS; hai guest dùng cùng raw UUID không va index, retry legacy raw key vẫn dedupe đúng, failed turn/quota rollback giữ nguyên. |
| Full server unit | `npx -y node@22.23.1 scripts/run-server-test-batches.mjs` trên snapshot review dựa staging | PASS 8/8 batches, 253 files / 2,532 tests. Focused logger/observability/privacy sau chỉnh tài liệu: 3/3 files, 16/16 PASS. |
| Client compile-only / release build | Node 22.23.1 Vite 8 với synthetic `VITE_API_URL=https://example.invalid/api` | Compile-only cuối PASS, 2,957 modules transformed, cảnh báo chunk >500 kB. Strict release pre/postbuild cần HTTPS API và dynamic SEO data; chưa gọi release build PASS. |
| Static gates | Client lint; UI regression baseline; secret scan; data-boundary scan; agent validation; AI tool validator; `git diff --check` | Đều exit 0; secret/data-boundary/agent/tool/diff gates được chạy lại trên snapshot pre-PR cuối. Lint 0 errors/1 warning cũ `TrainerTransferPanel.jsx:91`, UI regression 0 finding mới/0 high-confidence blocking. Không có rendered-browser evidence. |
| Local AI-chat E2E | Playwright Chromium qua Node 22.23.1, `e2e/ai-chat.spec.js` và loopback mock API | Diff hiện tại 7/7 PASS; gồm SSE coalesced partial render, A→B + citation isolation, Stop, provider failure → Retry/Edit + citation và confirmation. Không phải live provider/proxy E2E. |
| Provider/live, rollout | Plan 090a staging evidence ngày 2026-09-14 | CI/deploy identity, recovery, re-embed và acceptance 9/9 PASS. Synthetic fixture eligible trả một Search Test hit 98,7% ở threshold 0,75; authenticated Retry trả lời kèm WHO citation. Chat citation chưa được chứng minh là đến từ KB; AC-009 live smoke còn thiếu các behavior và fallback metrics. Fixture/conversations đã dọn qua staging UI; không có production mutation. |

`STAGING` phản ánh rollout và acceptance đã chạy, không phải production release GO.
Blocker còn lại là provenance KB của chat citation và các phần live smoke/fallback metrics
trong AC-009; Search Test và citation hiển thị riêng lẻ chưa chứng minh đủ contract này.

Review độc lập phát hiện và xác nhận đóng hai MED: compound TDEE/meal từng có thể chạy song song bằng macro bịa;
ordinary next-send sau provider rollback từng giữ ghost turn. Admin Search Test race đã PASS scoped review.
Review pre-PR tiếp tục đóng một MED: office-holder, giá/tỷ giá live, event result và standings vốn có thể bị route
`stable + model_prior`; deterministic router và golden eval giờ buộc evidence mới, đồng thời giữ câu office-holder/giá
lịch sử rõ ràng trên nhánh stable để không biến mọi câu có năm thành web search.
Client pre-PR review đóng thêm hai MED: response Edit/View cũ không còn ghi đè lựa chọn admin mới, và retry/edit
từ conversation A không còn kéo selected UI rời conversation B sau khi navigation đã đổi.
Low/High-carb explicit hiện lấy macro từ TDEE canonical trong compound và follow-up thuần diet/số bữa; câu có số đo
hoặc calo mới không dùng lại TDEE cũ. Một số diễn đạt đối lập hiếm vẫn có thể fallback Moderate-carb; identity
reconcile sau 3 lần thử có thể cần người dùng tải lại để bật feedback. Review delta AI `PASS WITH WARNINGS`
không có BLOCK/HIGH/MED mới: parser đối lập tiếng Anh, TDEE lưu lâu không có age gate cho follow-up thuần diet,
và assertion E2E partial có thể flaky trên CI cực chậm. Review logger/telemetry local cuối `PASS`: giữ request
context hiện hành, thay X-Request-Id không phải UUID bằng server UUID để tránh PII/collision, giữ correlation
request → response → log; việc này cố ý thu hẹp contract cho upstream từng gửi custom ID. Release vẫn
`NO-GO/BLOCKED` vì AC-009 live smoke chưa hoàn tất; local AI-chat E2E mock không
thay thế provider/proxy thật và staging success không cấp quyền production.

Review client pre-PR tiếp tục đóng race MED của Retry/Edit: action đang chờ reconcile hoặc fork bị vô hiệu hóa
nếu người dùng đã đổi navigation generation, kể cả chuỗi A → B → A; lỗi cũ không được ghi vào conversation mới.
Regression test RED → GREEN nằm trong focused 72/72 ở trên.

## Staging Rollout Evidence — 2026-09-14

Plan 090a đã đưa guardrails và embedding profile lên staging tại exact SHA
`b81fb159a829059fd04176325416d5ee53561236`. Canonical CI
[34830572458](https://github.com/ThienAress/htcoachingweb/actions/runs/34830572458),
Netlify `6aa7c5449e21464e943801c0` và Render `dep-dajsusbm8hqs739juqdg`
cùng SHA. Acceptance hậu re-embed
[34843937729](https://github.com/ThienAress/htcoachingweb/actions/runs/34843937729)
PASS 9/9, recovery gates PASS và cleanup `verified=true`, `residue=0`.
Public health read-only `2026-09-14T13:16:27.911Z` PASS 7/7 HTTP checks.

AI-chat E2E loopback mới PASS 7/7 trên Node `22.23.1`, bổ sung Stop, provider
failure → Retry/Edit, citation rendering và citation isolation khi A vẫn stream
trong lúc xem B. Diagnostic ban đầu trên seed `draft`, `vector: ready` nhưng chưa
review/evidence cho Search Test `0` ở threshold 0,75 và 0,60; exact seed question
route `general/model_prior`, nên Chat không có KB citation. Đây không phải bằng
chứng Atlas/vector hỏng.

Sau khi user duyệt fixture synthetic staging có nguồn WHO thật, entry `training`,
`published`, `vector: ready`, `source_backed` cho một Search Test hit `98,7%` ở
production threshold `0,75`. Authenticated HT Assistant lần đầu lỗi generic;
Retry thành công, trả claim ≥150 phút/tuần và hiển thị citation
`https://www.who.int/news-room/fact-sheets/detail/physical-activity`.
Search Test chứng minh entry eligible được retrieval; URL hiển thị trong Chat
chưa tự chứng minh citation có provenance KB thay vì một nguồn grounding khác.
Quota quan sát cuối `1197/1200`; không đổi chính sách quota/model/auth.

Sau user xác nhận xóa, hai conversation smoke và fixture WHO đã được xóa qua
staging UI. Sidebar không còn conversation; bảng KB từ hai entry về một
seed `draft` ban đầu. Exact WHO query sau xóa trả `0` ở cả threshold `0,75`
và `0,60`; admin conversation filter “Tất cả” không thấy conversation phù hợp.
Đây là cleanup quan sát qua UI, không phải DB-level residue verification.

Plan giữ `BLOCKED` dù rollout đang `LIVE`: AC-009 vẫn thiếu live Retry/Edit,
A→B streaming, Stop, provider-failure behavior và root/variant fallback metrics;
provenance KB của citation trong Chat cũng chưa được chứng minh. Các behavior này
có deterministic E2E evidence, không có live provider-failure injection.
Không có production write hoặc production rollout.

Post-smoke local hardening (chưa deploy) của Plan 090a đã thêm root/variant/combined
fallback counters và sửa preflight/rollback prior-state compatibility. Regression
local nay bao gồm snapshot mã hóa → giải mã → rollback trên Mongo cô lập và một
search fallback đồng thời root+variant; focused Node 22.23.1 hai file 46/46 PASS.
AI eval 49/49, loopback E2E 7/7 và release build 54/54 PASS. Test client đọc
raw source được normalize newline để độc lập LF/CRLF: full client Node 22.23.1
170/170 files, 816/816 tests PASS sau lần đầu 815/816 do CRLF. Những kết quả này
không phải live staging metrics hay rollback drill evidence. Full server trên
diff cuối PASS 9/9 batches, 258 files/2.581 tests; release build rerun sau khi
staging API hết cold-start timeout PASS prerender 54/54 và bundle/search-index gates.

## Done Criteria

- [ ] Tất cả 14 must-have acceptance criteria trong spec có test/command evidence.
- [x] Không thay model/quota, không bật guest search và không chạy production mutation.
- [x] Schema additive; legacy document có behavior được test và staging rollout/re-embed được ghi rõ, production vẫn ngoài scope.
- [x] Full unit, client build, AI/security/agent gates và blocker được ghi chính xác theo từng snapshot; local fix/test portability chưa deploy, không coi QA local là deployed-SHA evidence hay AC-009 live PASS.
- [x] Plan/index/machine state/traceability cập nhật đúng lifecycle thực tế.

## STOP Conditions

- Cần tự suy đoán nguồn/evidence cho production entries cũ.
- Cần gửi raw PII/health data sang provider để feature hoạt động.
- Grounding provider không cung cấp claim-to-source support hợp lệ mà câu trả lời vẫn cần khẳng định claim.
- Cần đổi quota, bật paid search cho guest hoặc chạy migration/re-embed production.
- Hai agents cần sửa cùng hotspot hoặc xuất hiện diff ngoài scope không xác định owner.
- Cùng một gate fail ba vòng sau các sửa có evidence.

## Maintenance Notes

- Khi rollout embedding profile mới, tạo preflight/re-embed plan có target và rollback riêng; không chỉ đổi env.
- Migration helper và compatibility test có thể thay đổi ở local, nhưng không chạy migration/backfill trên dữ liệu thật.
- Khi mở guest search, phải cập nhật service access policy và cost budget trước.
- Fitness/health evidence tier và review cadence nên được calibrate bằng corpus production sau khi owner cho phép đọc.
- Các file rule/privacy mới vượt 300 dòng (`knowledgePrivacy.js`, `requestRouter.js`, `personalHealthData.js`) vì chứa nhiều
  pattern và guard phụ thuộc thứ tự với corpus regression lớn; không tách cơ học trong cùng security change để tránh
  đổi semantics đã kiểm chứng. `retrievalQualityEvaluator.js` và các test matrix mới cũng vượt ngưỡng vì giữ fixture,
  assertion và negative controls cạnh nhau. Tách module theo boundary URL/identity/health và chia test suites trong
  một review riêng trước rollout rộng.
- Parser diet preference chỉ bind nhãn khi diễn đạt đủ rõ; cách nói đa nghĩa hoặc đối lập hiếm (ví dụ English
  `High-carb instead of Low-carb`) có thể dùng Moderate-carb canonical. Không suy diet từ macro do model tự gửi;
  cần mở rộng corpus ngôn ngữ sau khi có dữ liệu phản hồi thật, không tự đổi variant thiếu evidence.
