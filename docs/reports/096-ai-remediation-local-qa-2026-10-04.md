# HT Assistant: bản vá nguồn và acceptance, QA local ngày 2026-10-04

## Trạng thái

Bản vá nằm trong candidate checkout `.local-data/ai-progress-staging-20261003`,
HEAD `161f5a5cbf795b8325a86826046a58f18fe63dd2` + working tree dirty. Baseline
candidate cùng tree bản staging `32cf6e80ce698b98669d0761461b038072bff36e`.
Không sửa application files ở root checkout đang có nhiều thay đổi khác.
Đã đối chiếu GitHub Git-commit API (GET) với `git rev-parse HEAD^{tree}`:
cả hai có tree `c00e7c7cb54697963e0e29f1380f5631c1ae2764`.
Merge commit staging chưa có trong local object database; không fetch để đổi Git
state khi chưa có quyền promotion.

Chưa commit/push/deploy bản vá. Chưa chạy 15 câu live UI trên bản vá và chưa có
bằng chứng đạt 90%. Kết quả staging trước đó là 7 PASS / 4 PARTIAL / 4 FAIL cho
14 câu gốc + replacement câu 5; không phải exact original 15.

## Thay đổi có thể review

- Nguồn chọn lọc: chỉ nguồn KB có reviewed question identity khớp mới được chọn;
  vector proximity không đủ. Không đổi `web_required` thành KB khi có hit.
  Loại URL nguồn KB không được chọn tại delivery; giữ ordinary navigation links.
  Metadata nguồn được stream và persist trên final assistant turn.
- UI nguồn: chip avatar chữ + publisher từ hostname thật, click mở nguồn; không
  giả logo từ title, không gọi external favicon service. HTTPS/no-userinfo,
  dedupe tối đa 3 nguồn. Giữ disclosure khi Markdown inline không chắc đã render
  chip, kể cả URL trong code/image hoặc URL prefix. Mobile có touch target 44px.
- Exercise: cùng predicate beginner/equipment ở readiness và runtime; loại
  advanced/plyometric không phù hợp. Text và card dùng cùng canonical catalog.
- Workout: draft có bài, sets/reps/rest/RPE, thời lượng/progression/deload trong
  phạm vi hỗ trợ; constraints ngoài phạm vi quay về model/intake. Không dùng
  template khi có prior user context hoặc personal/conversation memory.
- Meal: scoped tofu→fish thay các vị trí có cùng canonical food ID, hoặc một bữa
  user chỉ rõ; giữ items khác, tính grams/totals bằng server, giữ kcal/minimum
  protein và allergy guards. Chỉ guard delta macro khi user yêu cầu giữ macro;
  yêu cầu tính lại macro cho phép macro đổi theo món mới. Context scoped chỉ do
  server truyền qua toolEngine, không đưa vào schema cho model.
- Safety/intake: joint discomfort không chẩn đoán hoặc hứa bài không tạo áp lực;
  nguồn AAOS chỉ hỗ trợ nguyên tắc không tập xuyên đau. TDEE giữ khoảng thời lượng.
  Ví dụ 7 ngày có foods/portions/exercises/recovery và ghi rõ không cá nhân hóa.
  Template từ chối food exclusions/preferences bất kỳ, không chỉ một noun list.

Prompt contract: `2026-10-03.v1`, SHA256
`e127ddcd482b4ff9a34ec9a8e8cd71104fd29ace6a3c110ff3aeeae948a72249`.

## Review và regression bổ sung

Reviewer độc lập ghi nhận configuration `gpt-6-astra/xhigh`, không có backend
routing receipt độc lập. Review cuối PASS trong phạm vi source/query boundary,
static context guard và scoped meal; không phải security audit toàn repository.

Hai lỗi được phát hiện và sửa: chuẩn hóa xóa dấu phẩy/chấm phẩy làm mất inherited
health subject; template bỏ qua “không ăn tôm”. Guard giữ private subjects và tên
bệnh ngoài danh sách, status modifiers, đồng thời giữ homographs dầu/đậu và các
educational queries. Test route/controller kiểm tra không gọi external search.
Full server gate phát hiện thêm false positive “đậu”→“đau”; đã thêm regression
đồng âm để bảo toàn safety refusal của meal tool. Một false positive khác với
whey + dây kháng lực cũng được sửa; regression vẫn chặn disclosure triệu chứng
sau mệnh đề equipment/protein. Không thay các assertions có sẵn để làm test xanh.

## Security coverage ledger

Target: candidate HEAD nêu trên + scoped dirty diff; phạm vi là existing AI
output/query boundary, static planning và meal substitution. Actor, ownership,
CSRF, quota và tool registry giữ nguyên; model/tool output là dữ liệu không tin cậy.

| Reviewed surface | Entry → validation/authorization → sink | Evidence |
|---|---|---|
| Citation delivery | KB/provider metadata → reviewed question identity + evidence policy → final SSE/persisted assistant turn | `answerSourcePolicy.test.js`, `aiSourcePolicy.integration.test.js` |
| Citation UI | Stored/streamed metadata → HTTPS/no-userinfo, host-derived publisher, exact URI binding → external anchor with noopener/noreferrer | Client citation tests, 12-test mock E2E, desktop/mobile render |
| Private health query | Message/retrieval query → subject/assertion classifier + `prepareExternalKnowledgeQuery`, authenticated web-tool bounds → external search | Privacy/router/controller tests; focused inherited/homophone 49 PASS; reviewer matrix 26/26 |
| Static planning | Current message + prior user/personal/conversation context → context-empty, low-risk, supported-constraint guards → bounded text draft | `workoutDraft.test.js`, `referencePlan.test.js`, controller remediation tests |
| Meal follow-up | User phrase + server-owned prior plan → canonical food IDs, scoped locations, catalog/allergy/kcal/protein/macro constraints → response draft/card only | Scoped substitution and suggest-meal tests; controller canonical flow |

Accepted findings đã sửa: inherited private subject qua punctuation/conjunction;
template bỏ qua explicit food exclusion; false positives đậu và equipment/protein.
Focused tests xác minh cả disclosure phải chặn và benign query phải giữ. Full
server suite re-validation tích hợp cuối đạt 10/10 batch, exit 0.

Deferred/proof gaps: không audit toàn repository, không đánh giá lại unchanged
auth/payment/wallet hoặc provider internals. Inherited subject window 120 ký tự
không chứng minh bao phủ mọi natural-language phrasing; classifier và external
query guard là hai lớp riêng, không suy classifier matrix thành privacy tuyệt đối.
Không thêm remote favicon fetch nên không có external domain/CSP change.

Codex Security: **PREFLIGHT ONLY**. Đã validate wrapper invocation cho
`--working-tree --dry-run --max-cost 2`; không gọi scanner/paid execution và không
có completed external scan. Artifact `security-preflight-remediation-final.json`
ghi rõ `scannerExecuted=false`. Local scans và independent bounded review là
bằng chứng security của bản vá này; preflight không được tính là security PASS.

## QA evidence

Node `22.23.1`, PATH đặt runtime này trước npm children. Logs/synthetic screenshots
ở `.local-data/staging-ai-resume-20261003/`. Không ghi secret hay hội thoại khách hàng
trong báo cáo này.

| Gate | Command | Kết quả |
|---|---|---|
| Client unit | `npm run test:unit:client` | PASS, exit 0, 186 files / 926 tests |
| Release build | `npm run build --prefix client` | PASS, exit 0, prerender/bundle budget/search index |
| E2E AI | `npm run test:e2e -- e2e/ai-citations.spec.js e2e/ai-chat.spec.js` | PASS, exit 0, 12 tests, mock API |
| AI eval | `npm run test:ai-eval` | PASS, exit 0, 73/73; 11 oracle fixtures, 0 live runtime captures |
| Tool validator | `node .agents/scripts/validate-tools.mjs` | PASS, exit 0, 11 tools / 0 warnings |
| Scoped client lint | ESLint 5 changed production ChatWidget files | PASS, exit 0 |
| UI regression | `npm run ui:audit -- --baseline scripts/ui-audit/baseline.json --fail-on-new-high` | PASS, exit 0, 0 new blocking, baseline unchanged |
| Secrets | `npm run security:secrets` | PASS, exit 0, delivery rerun |
| Dependency audit | `npm run security:audit --prefix client` và `--prefix server` | PASS, exit 0, waived advisories [] |
| Data boundaries | `npm run security:data-boundaries` | PASS, exit 0, delivery rerun, 0 violations |
| Docs privacy | `npm run security:docs-privacy` | PASS, exit 0, final report rerun |
| Governance | `npm run agents:validate` | PASS, exit 0, final status rerun, 0 warnings |
| Server full | `npm run test:unit:server` | PASS, exit 0, 296 files / 3338 tests, 10/10 batches |
| Integrated AI boundary | Vitest 6 affected files, Node 22 | PASS, exit 0, 6 files / 604 tests trước guard thiết bị cuối; full suite kiểm chứng lại |
| Final boundary focused | Vitest 4 affected files, filter inherited/homophone | PASS, exit 0, 49 passed / 781 skipped |

QA mode: full local layer checks + targeted AI E2E. Nguồn execution là tool exit
và logs của từng command; đây là evidence tự khai, không phải immutable CI artifact.
Chưa tạo machine-readable QA full evidence: contract chỉ allowlist exact
`npm run test:e2e`, còn lượt này dùng hai specs cụ thể. Không bỏ arguments hoặc
gọi subset đó là full repository E2E để vượt validator.

Log refs: `client-full-remediation-final.log`,
`client-release-remediation-final2.log`, `e2e-remediation-final2.log`,
`ai-eval-remediation-final3.log`, `server-full-remediation-final4.log`.
Client/build/E2E hoàn tất trước server-only privacy correction cuối; correction
được cover bằng focused server tests, AI eval mới và full server suite cuối.
Source fingerprint `remediation-source-fingerprint-qa.json` có 40 changed
code/test files; application edit cuối lúc `2026-10-03T18:19:05.360Z`, trước
server full lúc 01:20 ngày 2026-10-04 (Asia/Saigon). Không đổi code/test sau đó.

Release build dùng public staging API cho VITE/SITEMAP/PRERENDER_API_URL,
REQUIRE_DYNAMIC_ROUTES=true và VITE_TODAY_PLATFORM_ENABLED=true. Lần sandbox đầu
BLOCKED bởi network EACCES; chạy lại với escalation đã được auto-review chấp nhận.
Sitemap generated changes được bỏ khỏi patch bằng nội dung baseline, build outputs
được giữ trong ignored dist.

E2E lần đầu 11 PASS / 1 FAIL ở transient streaming indicator; teardown Windows
không thoát do quyền đóng server. Chỉ hai server QA đã xác minh ancestry được đóng.
Lần chạy lại đủ 12 tests với quyền process cleanup đạt PASS, runner tự đóng server.
Không sửa test expectation hay thời gian SSE để làm test xanh.

## Side effects, giới hạn và bước promotion

Không đổi schema, auth/CSRF/quota/provider model; không migration/seed/production
write. Source avatar hiện là monogram, không phải logo/favicon thật. KB matching
cố ý thận trọng; không chứng minh mọi paraphrase đều được nhận nguồn. Static
draft chỉ hỗ trợ phạm vi mô tả; unsupported constraints còn phụ thuộc model/intake.

Server QA đã hoàn tất; artifact fingerprint giữ bản vá cụ thể để review. AGENTS yêu cầu
Git read-only khi chưa có yêu cầu Git cụ thể; approval tiếp theo là branch/commit/
push/PR và deploy staging cho chính bản vá đã review. Không deploy production.
Sau promotion, xác minh GitHub/Netlify/Render/runtime cùng exact SHA mới rồi chạy
15 câu qua staging UI bằng provider thật; giữ chains 4→5 và 6→7 cùng hội thoại.
Target ≥14/15 là mục tiêu nghiệm thu, chỉ báo đạt khi quan sát live.

Read-only planner (`ht-planner / Sol high`, requested/unverified) đã rà readiness:
helper `original15-runner.mjs` cũ dùng API/SSE và khóa SHA baseline, còn harness
reliability canonical chỉ có 11 prompts. Không dùng một trong hai để tuyên bố
đã chạy 15 câu UI trên bản vá. Browser plumbing hiện có có thể tái sử dụng cho
UI diagnostic với synthetic actor, requestId/persisted-turn binding, fresh
receipts và exact cleanup. Lượt 15 câu là đánh giá UI riêng; không tự mở rộng
AC-009 certified cohort, backend capability hoặc production promotion schema.

## Staging release gate

Target: staging. QA PASS theo execution logs/exit codes nêu trên; security local gates/review đạt trong
phạm vi nêu trên, external Codex Security chỉ preflight. SEO SKIP vì không sửa
public route/meta/sitemap/prerender code. Cleanup code đạt, không đổi UI baseline;
artifact fingerprint cuối được tạo sau khi chốt toàn bộ docs và QA.

Promotion evidence: PENDING, chỉ tạo sau exact-SHA live staging acceptance.
Kết luận local: **GO FOR STAGING**, chưa có quyền Git/deploy. Không có finding
BLOCK/HIGH hoặc MED đã xác nhận còn mở trong bounded diff review; proof gaps
và phần ngoài phạm vi vẫn được giữ riêng, không suy ra audit toàn repository.
