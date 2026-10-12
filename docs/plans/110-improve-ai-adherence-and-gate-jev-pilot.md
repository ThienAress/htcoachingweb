# Plan 110: Cải thiện độ bám câu hỏi trước, thử JEV có điều kiện

> Đề xuất để user duyệt, không phải lệnh triển khai. Làm theo từng gate, không bật JEV ngay.
> Drift check đầu tiên: đối chiếu deployment hiện tại và workspace được duyệt với snapshot bên dưới.
> Nếu khác, cập nhật evidence/impact trước khi code; không tự pull, checkout hoặc ghi đè thay đổi của user.

## Status

- **Priority**: P0
- **Complexity**: COMPLEX
- **Effort**: L, chia nhiều session theo case; lịch live phụ thuộc approval và lượng mẫu.
- **Risk**: HIGH khi chạm dữ liệu hội thoại/vendor; lượt này chỉ tài liệu.
- **Depends on**: kiểm tra drift chuỗi 092, 094–094C, 095, 096–096C đã có; không chạy lại mặc định.
- **Category**: tests / reliability / perf
- **Planned at**: 2026-10-12
- **Lifecycle**: PLANNED — chờ duyệt spec và roadmap
- **Verification**: NONE — chưa có bằng chứng thực thi sản phẩm theo Plan 110
- **Rollout**: NOT STARTED
- **Owner**: root
- **Updated at**: 2026-10-12

## Why This Matters

DeepSeek + Brave đã hoạt động; vấn đề cần giải là câu trả lời có bám đúng ý, giữ scope và dùng đúng evidence hay không.
Router, memory và provenance đã tồn tại nên không đề xuất xây lại chỉ từ video/nhận định chuyên gia.
Đo lỗi trước, sửa đúng lớp rồi mới so sánh JEV với DeepSeek selector giúp tránh thêm latency/chi phí vô ích.
Hai kết thúc hợp lệ: phát hành baseline đã cải thiện không JEV, hoặc thêm JEV sau khi có lợi ích được chứng minh.

## Current State — snapshot, không phải lời khẳng định live vĩnh viễn

Read-only Render snapshot lúc khoảng 12:08–12:11 ICT, 2026-10-12: cả production/staging dùng
SHA `af1a6cfc9191897d92bb51dc312029882259ed89` và cấu hình không nhạy cảm:

```text
AI_PROVIDER=deepseek
DEEPSEEK_MODEL=deepseek-flash
DEEPSEEK_ENDPOINT_PROFILE=official
AI_WEB_SEARCH_PROVIDER=brave
AI_KB_RETRIEVAL_MODE=llm_selection
```

Production: service `srv-d70gd0fafjfc73csn9ag`, deploy `dep-db66a0rbc2fs73avhgpg`.
Staging: service `srv-d9g8em61a83c73b4l61g`, deploy `dep-db66c5tckfvc73ca5olg`.
Readiness hai môi trường 200; staging log 05:01:53Z ghi DeepSeek thành công, Brave 200/grounded/3 sources.
Đây không phải benchmark chất lượng. Local HEAD `b102572c626b1b79c290a786c96a51ebfc28c242` cũ, worktree dirty.

Các line dưới đây thuộc **deployed SHA**, không phải line trong checkout local:

- `server/src/controllers/ai.controller.js:1212–1219`: contextual query và `routeAiRequest`.
- `server/src/services/ai/requestRouter.js:547–591`: domain/risk/freshness/evidence, KB/web/tool policy.
- `server/src/controllers/ai.controller.js:1070–1073,1322–1353`: memory/context và KB eligibility gate.
- `server/src/controllers/ai.controller.js:1391–1433`: retrieval failure và low-risk missing-evidence policy.
- `server/src/controllers/ai.controller.js:2416–2439`: scope validation, retry/fallback cho amendment.
- `server/src/services/ai/deepseekKnowledgeSelection.service.js:15–16,83,123–158`:
  64 candidates/64 KiB, tối đa 3 refs; privacy/publication/review filters, DeepSeek call, reread/revision checks.
- `server/src/services/ai/knowledgeSelectionPolicy.js`: chat selection 12 giây; general cap 30 giây.
- `server/src/services/ai/responseProvenance.js`, `scopePreservation.js`: giữ nguồn và scope hiện hành.
- `scripts/run-ai-evals.mjs`: fixture/contract runner; corpus snapshot có 73 cases, không phải live benchmark.

Không có evidence rằng cap KB hiện đang gây lỗi production. Không lấy giới hạn thiết kế làm bug đã quan sát.
Nguồn spec canonical và ranh giới hành vi nằm trong [spec bổ sung](../specs/ai-adherence-evaluation-and-jev-pilot.md).
Các tài liệu mới hơn chưa có trong checkout cũ dùng permalink SHA tại spec; không copy lại hàng loạt.

## Scope và contracts

Trong lượt hiện tại: chỉ plan/spec/traceability và index/state tương ứng; không sửa app.
Trong các lượt implementation được duyệt, file map cho từng slice:

- Evaluation: `scripts/run-ai-evals.mjs`, `server/src/services/ai/evals/aiEvalRunner.js`,
  `server/src/services/ai/evals/semanticOutputEvaluator.js` và tests/corpus cùng thư mục nếu cần.
- Harness mới dự kiến: `scripts/ai-adherence/{run,score,verify-evidence}.mjs` và `.test.mjs` tương ứng;
  synthetic cases dưới `server/src/services/ai/evals/corpus/adherence/`, chia theo nhóm dưới 300 dòng/file.
- Reuse capture patterns: `server/src/scripts/stagingAiReliabilityAcceptance{,.http,.evidence,.plan}.js`.
- Fix candidates: `server/src/controllers/ai.controller.js`, `requestRouter.js`, `conversationHistory.js`,
  `conversationMemory.js`, `scopePreservation.js`, `responseProvenance.js`, `knowledgeClaimCitation.js`,
  `knowledgeRetrieval.service.js`, `knowledgeSelectionPolicy.js` dưới `server/src/services/ai/` và tests tương ứng.
  Trước mỗi fix phải khóa tập con/symbol thực sự liên quan; không sửa tất cả các file này mặc định.
- Pilot mới dự kiến: `server/src/services/ai/jevKnowledgeSelection.service.js`,
  `knowledgeSelectionExperiment.js`, tests cùng thư mục; nối qua `knowledgeRetrieval.service.js`.
- Evidence tổng hợp đã làm sạch: `docs/reports/ai-adherence-110/`; raw capture không vào Git.
- Runbook mới khi triển khai: `docs/operations/runbooks/ai-adherence-and-jev-pilot.md`.

Không đổi public API/SSE/card, tool registry, auth/quota, schema, frontend, medical safety hoặc hạ tầng mặc định.
Nếu evidence yêu cầu mở rộng ngoài tập này, cập nhật spec/impact và xin duyệt trước.
Adapter contract/ref filters/deadline/abstain nằm trong spec, phải giữ `{ results, retrieval }` cho consumers.
Flags dự kiến: `AI_KB_SELECTOR_EXPERIMENT=off|shadow|canary` mặc định `off`; chưa tồn tại trong runtime.
Config này tách khỏi `AI_KB_RETRIEVAL_MODE`, không tự đổi KB mode hay provider sinh đáp án.

## Commands You Will Need

Chạy từ workspace **đã được duyệt**, Node 22.23.1; không chạy acceptance từ checkout cũ hiện tại.
Lệnh dưới tồn tại tại deployed SHA. Các lệnh release cần manifest/env theo runbook release-promotion hiện hành.

| Mục đích | Lệnh | Expected / quyền cần có |
|---|---|---|
| Local identity | `git rev-parse HEAD` (từ thư mục workspace đã duyệt) | SHA trùng base được duyệt |
| Dirty-state audit | `git status --short` (từ thư mục workspace đã duyệt) | Không ghi đè thay đổi cũ |
| Node | `node --version` | `v22.23.1` trước product QA |
| Fixture | `npm run test:ai-eval` | Exit 0; không chứng minh live adherence |
| Server suite | `npm run test:unit:server` | Exit 0 trên test env cô lập; không tự thêm filter flags |
| Governance | `npm run agents:validate` | State/index/trace hợp lệ |
| Data boundaries | `npm run security:data-boundaries` | Exit 0; xử lý finding đúng scope |
| Secret scan | `npm run security:secrets` | Exit 0, không in secret |
| Deploy identity | `npm run verify:staging-deploys` | Identity khớp approved release; không đo chất lượng |
| Staging chat | `npm run acceptance:staging:ai --prefix server` | Chỉ sau duyệt host/account/budget/data |
| Staging reliability | `npm run acceptance:staging:ai:reliability --prefix server` | Như trên; có confirmation guard |
| Release candidate | `npm run verify:release-candidate` | Evidence hợp lệ; không phải quyền deploy |
| Post deploy | `npm run verify:post-deploy` | Chỉ sau deployment được duyệt |

Acceptance scripts có thể tạo user/conversation, truy cập Mongo, gọi provider và cleanup: không phải read-only.
Đọc config/confirmation hiện hành trước chạy; reliability dùng `CONFIRM_STAGING_AI_RELIABILITY`.
Cap 180 giây của verifier staging không phải latency mục tiêu UX.

CLI dưới đây **chưa tồn tại**, chỉ được chạy sau khi Step 2 implement/test xong:

```text
node --test scripts/ai-adherence/run.test.mjs scripts/ai-adherence/score.test.mjs
node --test scripts/ai-adherence/verify-evidence.test.mjs
node scripts/ai-adherence/run.mjs --mode=mock
node scripts/ai-adherence/verify-evidence.mjs --gate=baseline
```

Contract CLI dự kiến: `run.mjs` mặc định mock/offline; capture chỉ staging với approved manifest,
host allowlist, tài khoản synthetic, call/spend ceiling và cleanup receipt; không mặc định gọi provider.
`verify-evidence.mjs --gate=baseline|improved|pilot|shadow|canary|closure` đọc report tương ứng trong
`docs/reports/ai-adherence-110/`; kiểm schema, provenance, gate và approval references, không gọi mạng.
Report chứa SHA/config hashes, dataset/split revision, evidenceKind, số case, metrics, reviewer và quyết định.
Không chứa user ID, token, history hay raw health data; report kiểm đủ bằng chứng, không tự chứng nhận rubric đúng.
`no_go`/`inconclusive` được ghi là quyết định, không phải chất lượng pass; gate sau không được tự mở.
Nhánh bỏ JEV có report pilot/shadow/canary `not_applicable` liên kết quyết định được duyệt;
verifier không đòi chạy provider/test adapter chưa tạo, nhưng không cho phép dùng nhãn này để mở rollout.

## Steps — P0→P6 là thứ tự triển khai, không phải bảy cấp incident severity

### Step 1: P0 — Khóa baseline đúng và mục tiêu được duyệt

**Behavior:** mọi người dùng cùng deployment/source, biết sẽ đo gì và không đụng worktree/dữ liệu của user.
**Depends on:** user duyệt spec/roadmap, workspace/base SHA; chưa cần tài khoản JEV.
**Blast radius:** metadata ở `docs/reports/ai-adherence-110/`, không app/runtime mutation.

1. Kiểm tra lại production/staging SHA và config allowlist; xử lý drift với các task đang làm song song.
2. User chọn workspace sạch/base phù hợp; không tự thực hiện Git mutation để "đồng bộ" checkout cũ.
3. Chốt rubric/split, nhóm lỗi ưu tiên, SLA và budget/calls/retention trước capture.
4. Ghi invariants auth/quota/privacy/health/source permission; xác định ai review và ai cho phép rollout.

**Verify:** identity/Node commands ở trên, `npm run agents:validate`; manifest được review/duyệt.
**Gate:** không còn nhầm local/deployed; Node đúng; scope, tài khoản và budget rõ trước việc có chi phí.
**Output:** baseline manifest + danh sách mục tiêu/approval, chưa phải kết quả chất lượng.

### Step 2: P1 — Có benchmark câu trả lời nhiều lượt đáng tin

**Behavior:** tái hiện/chấm được lỗi "hỏi A trả lời B", mất ràng buộc, đổi quá scope hoặc nguồn không hỗ trợ.
**Depends on:** Step 1; provider capture cần approval riêng.
**Blast radius:** evaluation/harness/corpus paths; reuse staging HTTP và semantic evaluator đã có.

1. Freeze synthetic/public dataset theo spec; bổ sung case thiếu vào suite cũ, không nhân đôi corpus vô ích.
2. Implement tối thiểu runner mock, capture opt-in và report verifier; tuyệt đối tách fixture khỏi actual output.
3. Chạy baseline DeepSeek + Brave; phân lỗi context/router/retrieval/selector/generation/citation/UI nếu có.
4. Chấm ẩn tên phương án, ghi metric từng nhóm và total latency/cost; giữ holdout chưa dùng để tuning.

**Verify:** `npm run test:ai-eval`, các `node --test` mới ở trên, mock runner và
`node scripts/ai-adherence/verify-evidence.mjs --gate=baseline`.
**Gate:** có report baseline thật trong budget, provenance đầy đủ; thiếu capture thì chỉ kết luận fixture pass.
**Output:** ranking lỗi có case tái hiện, không chỉ một điểm trung bình.

### Step 3: P2 — Sửa baseline theo từng lỗi và bàn giao độc lập JEV

**Behavior:** giữ đúng ý/ràng buộc ở case thất bại; sửa một phần kế hoạch không làm đổi phần còn lại.
**Depends on:** Step 2; mỗi case/fix là một slice riêng, không triển khai một refactor lớn.
**Blast radius:** chỉ tập con fix candidates đã trace cùng regression tests.

1. Case fail → regression test → thay đổi tối thiểu → replay; ưu tiên context/scope trước đổi selector.
2. Thiếu evidence thì sửa đường truy xuất/provenance tương ứng, không chỉ thêm lời nhắc vào system prompt.
3. Giữ guard hiện có; chỉ xử lý cap/candidate prefilter nếu đo được đây là nguyên nhân và review lại scope.
4. So baseline/holdout; staging acceptance và phát hành riêng sau approval, không chờ JEV.

**Verify:** `npm run test:ai-eval`, `npm run test:unit:server`,
`node scripts/ai-adherence/verify-evidence.mjs --gate=improved`;
ai-check/impact-check + QA/release gates hiện hành. Staging commands chỉ sau approval.
**Gate:** đạt mục tiêu đã freeze, critical suite không regression; không đạt thì sửa tiếp đúng lỗi.
**Output:** bản DeepSeek + Brave tốt hơn có evidence. User có thể chọn kết thúc baseline-only → Step 7.

### Step 4: P3 — So JEV với selector DeepSeek, ra quyết định có/không

**Behavior:** cùng query/candidates tạo được lựa chọn có thể so sánh; pilot không ảnh hưởng chat đang chạy.
**Depends on:** Step 3 và user chọn tiếp tục; review vendor/API/privacy/budget trước external calls.
**Blast radius:** adapter/experiment/tests mới, harness; không nối vào serving path ở giai đoạn này.

1. Xác minh API/typed output hiện hành; không dùng endpoint/sample OpenRouter từ attachment làm nguồn tin cậy.
2. Benchmark public/synthetic candidates cố định: relevance refs, abstain, consistency, p95 và chi phí.
3. So cả đáp án cuối với cùng DeepSeek generator; selection tốt không tự suy ra adherence tốt.
4. Test selected/no_match/error, refs lạ/trùng, injection, stale revision, cap và tổng deadline 12 giây.

**Verify:** `npm run test:unit:server`, `npm run test:ai-eval`,
`node scripts/ai-adherence/verify-evidence.mjs --gate=pilot` sau capture được duyệt.
**Gate:** đạt một lợi ích theo spec, không critical regression, khoảng bất định đủ kết luận.
**Output:** `go`, `no_go` hoặc `inconclusive`; hai kết quả sau giữ off, không tự mở shadow.

### Step 5: P4 — Shadow staging có trần chi phí, không thay đáp án

**Behavior:** baseline vẫn phục vụ; shadow chỉ thu so sánh trong cohort synthetic/low-risk được duyệt.
**Depends on:** Step 4 `go` và approval shadow/retention/budget độc lập.
**Blast radius:** experiment/adapter, `knowledgeRetrieval.service.js`, tests và runbook.

1. Flag mặc định off; bounded concurrency/queue, hard call/spend cap; không gửi dữ liệu thật mặc định.
2. Shadow có abort/deadline, không giữ SSE response chờ nó; đo cả resource contention/queue overhead.
3. Inject timeout/schema/ref/injection/stale/cancel cases; thử kill switch, không còn call/retry mới.
4. Đề xuất quan sát 24–48 giờ nhưng phải đạt sample đã duyệt; hết giờ không tự tính là pass.

**Verify:** `npm run test:unit:server`, hai staging acceptance commands,
`node scripts/ai-adherence/verify-evidence.mjs --gate=shadow`.
**Gate:** đủ mẫu, metric/safety/chi phí đạt; không có real-answer mutation do shadow.
**Output:** staging evidence + rollback drill. Shadow vẫn tốn API calls, không gọi là read-only/free.

### Step 6: P5 — Canary giới hạn rồi mới mở rộng

**Behavior:** JEV thay đúng selection call trong cohort đủ điều kiện, không thêm call vào mọi câu hỏi.
**Depends on:** Step 5 pass, release approval và target/cohort/budget cụ thể.
**Blast radius:** experiment/config được duyệt; generator, Brave, auth/quota/health policy giữ nguyên.

1. Đề xuất 5% → 20% → 50% → 100% traffic **đủ điều kiện**, không phải toàn bộ người dùng/yêu cầu.
2. Mỗi nấc phải có số mẫu/thời gian/gate duyệt trước, baseline control cùng thời kỳ và xem metrics theo nhóm.
3. Error fallback chỉ dùng budget còn lại; valid no_match đi policy thiếu bằng chứng, không coi là provider lỗi.
4. Kill switch quay về DeepSeek selector; security/privacy/critical failure dừng ngay, thiếu mẫu không tăng nấc.

**Verify:** `npm run verify:release-candidate`, `npm run verify:post-deploy`,
`node scripts/ai-adherence/verify-evidence.mjs --gate=canary`.
**Gate:** chất lượng không giảm ngoài margin, SLA/cost đạt; không rollback được thì không mở production.
**Output:** rollout receipts theo SHA/config; giảm/tắt pilot được xem là vận hành đúng, không cố giữ JEV.

### Step 7: P6 — Đóng vòng đo lường, vận hành và bàn giao

**Behavior:** có baseline-only hoặc JEV-adopted được chứng minh; người vận hành biết khi nào tắt/đo lại.
**Depends on:** Step 3 hoặc Step 6; nhánh bỏ JEV ghi các bước không chạy là not_applicable có lý do.
**Blast radius:** reports/runbook/index/state/traceability; không tự xóa evidence/code backup của user.

1. Đề xuất cửa sổ quan sát 7 ngày sau release, kèm sample floor và ngân sách được duyệt.
2. Chốt adherence theo nhóm, critical regressions, p50/p95, fallback/timeout và cost toàn request.
3. Runbook ghi owner/alert, retention, rollback và re-eval khi model/prompt/KB/router thay đổi.
4. Cập nhật machine state theo evidence thật; không bắt buộc thêm monitoring service/automation mới.

**Verify:** `node scripts/ai-adherence/verify-evidence.mjs --gate=closure`,
`npm run agents:validate`, data-boundaries/secret scan;
`npm run verify:post-deploy` nếu có deployment trong scope. Không triển khai thì không ghi rollout LIVE.
**Gate:** đủ evidence/approval/owner và không còn lỗi critical mở; chưa đủ mẫu thì chưa đóng phần live.

## Test Plan, STOP và Done Criteria

Patterns: `server/src/services/ai/__tests__/deepseekKnowledgeSelection.test.js`,
`knowledgeSelectionDeadline.test.js`, `scopePreservation.test.js`, `responseProvenance.test.js`;
tool boundary: `server/src/services/ai/tools/__tests__/toolResultBoundary.test.js`.
New tests phải bao phủ case cụ thể trong Steps 2–6, privacy bypass, revision race và metadata compatibility.
Thực thi QA theo skill `qa`; không đoán các focused flags của batch runner.

STOP nếu source/config drift, không có quyền capture/deploy, budget hết hoặc dữ liệu nhạy cảm có thể ra vendor.
STOP nếu phải nới guard/thêm schema/store/đổi API hoặc sửa file ngoài scope; review lại spec trước.
Verification lỗi: tự xác định nguyên nhân và sửa tối đa 3 vòng trong scope; không che môi trường thiếu bằng pass.

- [ ] Dataset/rubric frozen, actual baseline + cải thiện đã review; fixture không bị tính là live evidence.
- [ ] Bản baseline có regression proof; quyết định JEV và nhánh bỏ qua đều có lý do/evidence.
- [ ] QA, staging và release evidence đúng nguồn; các bước có chi phí/ghi dữ liệu được duyệt riêng.
- [ ] Không giảm privacy/auth/quota/health/source guards; deadline/fallback/kill switch được kiểm tra.
- [ ] Runbook, owner, retention, final metrics và state/traceability khớp kết quả thực.

## Maintenance Notes

Giữ baseline DeepSeek selector và off switch trong pilot. Không thêm evaluator thành runtime gate mọi request.
Khi model, candidate policy, KB revision hoặc prompt đổi, xác định lại evidence nào còn hợp lệ trước reuse.
Plan ID 110 được đối chiếu local/available refs; nếu một task khác chiếm ID trước khi tích hợp, đổi bộ ID đồng bộ.

## Kiểm tra bộ tài liệu ngày 2026-10-12

Traceability riêng Plan 110 PASS: 7 requirements, 14 AC, 7 tasks; links local và whitespace PASS.
Machine-state validation trên các entry có file hiện hữu PASS, bao gồm 110; đây không phải full-catalog pass.
`git diff --check` cho ba index/state chỉnh sửa PASS. Không chạy product tests/build hoặc provider capture.
`npm run agents:validate` toàn repo FAIL: Git inventory ownership, plan 090 thiếu file và trace catalog thiếu spec.
Giữ nguyên các lỗi checkout có sẵn, không khôi phục tài liệu ngoài scope. Product Verification vẫn NONE.
