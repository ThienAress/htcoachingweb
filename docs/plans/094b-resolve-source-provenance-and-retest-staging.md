# Plan 094B: Hiển thị đúng publisher và kiểm lại HT Assistant qua UI staging

## Status

- Priority: P1; complexity: COMPLEX; risk: HIGH (AI output và outbound request).
- Lifecycle: IN PROGRESS; verification: FOCUSED; rollout: PENDING.
- Owner: root / 01a0ffb5-31c7-7360-93e3-3de14e9289dc; updated at: 2026-10-04.
- Depends on: 094A; category: bug; effort: M.

## Why This Matters

PR191 staging đạt 11/15 PASS, hai FAIL và hai PARTIAL. Hai catalog updates đã
được owner duyệt và apply riêng; chưa retest. UI nguồn đang gọi Google redirect
là publisher, lặp nguồn sau nhiều đoạn. Câu hỏi nhận diện người nổi tiếng còn
tự thêm statistics biến động không cần thiết. Mục tiêu vẫn ≥14/15 qua UI thật,
không nới rubric hoặc safety/cost guards.

## Current State và dependency map

- Base staging `ff7ff4408a1b8b1aae6e660f3586296019dd86d6`, checkout cô lập;
  branch `codex/ai-verified-source-followup-20261004`. Dirty workspace gốc giữ nguyên.
- `searchKnowledge.tool.js:123` normalize chunk title/uri; `:178` dựng supported
  segments; `:290` system instruction chung. Chỉ claim có grounding support được trả.
- `toolEngine.js:28` strip source metadata xuống title/uri; `:283` pass card.
- `ChatBubble.jsx:78` bind nguồn từ card vào đúng message và chip qua URI.
- `citation.js:43` derive publisher từ transport URI; `SourceAvatar.jsx` dùng monogram.
- SSE và history lưu card qua Mixed payload; không cần schema/controller/hook change.
- Spec canonical: `docs/specs/ht-assistant-reliability.md`, AC-030–035 và REQ-011.

## Contract và hard boundaries

Giữ `source.uri` là HTTPS link provider để click. Additive field
`source.provenance = { kind: "google_grounding_redirect", publisherHost }` chỉ do
server tạo sau quan sát Location từ Google endpoint; không chứng nhận nội dung
hoặc final landing page. Không dùng title/domain chưa xác minh của model làm publisher.
Old source không có provenance vẫn tương thích; redirect unresolved hiện globe/
“Nguồn web”. Source direct derive từ URI như trước.

Resolver chỉ GET exact `https://vertexaisearch.cloud.google.com/grounding-api-redirect/`
với single opaque token path (base64url và padding `=`) đã validate, no query/
credentials/non-default port/control chars.
`redirect: manual`, không request hoặc DNS lookup Location destination; cancel body
ngay sau headers. Reject Location non-HTTPS, credentials, non-default port, IP literals,
localhost và reserved/internal suffixes. Tối đa 3 requests song song, một request/source,
không retry. Best-effort budget ≤750ms trong deadline tool hiện có, bỏ enrichment khi
còn ≤500ms; không tăng 15s tool / 75s turn. Abort caller được giữ. DNS/TLS/egress của
runtime là trust assumption; không claim chống compromise DNS/runtime tuyệt đối.

Dedupe key là normalized transport URI (strip hash), first wins, insertion order,
request/message lifetime, max3; không dedupe theo publisher host vì khác bài cùng host.
Chỉ emit citation đầu tiên cho mỗi URI trong một answer; giữ hỗ trợ claim trước output.
Không favicon external, dependency mới, CSP wildcard hoặc cache liên người dùng.

In scope: searchKnowledge tool/tests; source provenance module/tests;
toolEngine/tests; identity-answer instruction module/tests; citation/SourceAvatar/
CitationChip/WebSourcesCard/ChatBubble và tests liên quan; aiSourcePolicy integration
và `e2e/ai-citations.spec.js`; spec/plan/evidence.
Out of scope: schema, auth, quotas, provider model, runtime timeout/retry caps,
production deploy/write, catalog mutation thêm và frozen UI15 grader/corpus.

REQ-001–010 kế thừa được map tới Step 4 như compatibility verification;
traceability của 092/094A bổ sung REQ-011 vào bước tích hợp hiện có vì validator
kiểm mọi yêu cầu của cùng spec canonical. Mapping không phải evidence đã chạy
live hoặc tuyên bố các rollout trước đã hoàn tất.

## Steps và ownership

### Step 1: Trả lời nhận diện ngắn đúng phạm vi

Identity worker owns module `knowledgeAnswerScope.js` và tests tương ứng; root
integrates instruction trong searchKnowledge. Nhận diện generic Vietnamese/English
“X là ai / who is X / giới thiệu về X”, không hardcode Ronaldo. Khi user hỏi stats,
records, current counts/date/timeline rõ thì giữ scope đó; identity thuần chỉ 2–3 câu
nhận diện, không tự thêm age/counts/current tallies. Privacy preparation chạy trước.
Verify: focused searchKnowledge + scope tests, supported-only và ≤1 provider call.

### Step 2: Publisher từ provider redirect Location

Backend worker owns module sourceProvenance và toolEngine/test delta. Enrichment
đặt trong engine sau tool để card và meta cùng normalized sources; không resolve
lần hai trong searchKnowledge. Root owns searchKnowledge scope/dedupe integration.
Chạy RED→GREEN cho fixed-origin resolver, hostile URL,
Location, timeout/abort/no-follow/no-secret-header và provenance normalization.
FE worker owns citation files/tests, sau contract đã khóa: source URI giữ nguyên,
publisher/avatar derive từ validated provenance; unresolved globe, spoof title vẫn
không impersonate publisher. Verify engine→card/meta và ChatBubble live/history fixture.

### Step 3: Citation xuất hiện một lần

Root owns supported-segment assembly: mỗi URI chỉ phát một link/chip trong answer,
không remove grounding support gate. Verify repeated source multi-segment, three-source
bound, no unrelated model link và unchanged missing evidence behavior.

### Step 4: Review, QA, deploy và UI15

Root đọc diff và independent security review (Astra/xhigh), QA một lần cho snapshot
cuối. Commands từ candidate root: `npm run test:unit`, `npm run build --prefix client`,
`npm run test:ai-eval`, `node .agents/scripts/validate-tools.mjs`,
`npm run ui:audit -- --baseline scripts/ui-audit/baseline.json --fail-on-new-high`,
client lint, secrets/data-boundaries/docs-privacy, `npm run agents:validate`.
Expected exit0. Local targeted AI E2E qua Playwright khi dev servers đủ điều kiện;
render desktop/mobile. Không gọi mock E2E là live.

Quyền promotion staging đã có. Commit/push PR/merge sau local gates; attach PR.
Provider APIs xác minh exact merge SHA, READY/LIVE và served HTML/assets/runtime.
Refresh KB read-only (26 published /2 hold) và backup recovery trước UI fixture.
Adapt helper target/SHA/artifact paths, giữ corpus 14 original + replacement5 và
frozen grader/rubric. Run UI15 một lần per labelled round, chấm thủ công nội dung/
source relevance theo rubric; cleanup `verified=true`, residue0 bắt buộc.

## Done criteria và STOP

- ≥14/15 live UI PASS; PARTIAL không tính PASS; global source UI đạt click/avatar/
  publisher, ≤3 unique nguồn và không lặp chips.
- Không spoof publisher bằng title; resolver không truy cập arbitrary destination.
- Release build/client/server/AI/UI/security gates PASS hoặc báo rõ BLOCKED.
- Exact CI/Netlify/Render/assets/runtime SHA khớp bản mới; cleanup residue0.
- Không tăng timeout/retry/quota hoặc sửa grader/corpus để nâng điểm.
- Nếu cần đổi schema, arbitrary outbound fetch hoặc mutation ngoài scope: dừng
  dependent action và bổ sung plan/authorization, không tự nới guard.
- Nếu cùng gate fail ba vòng sửa có căn cứ, ghi blocker; không tiếp tục rerun lấy điểm.

## Evidence

### Follow-up sau live round1 PR192

PR192 merged8cca5a8, CI5/5, providers/served/runtime cùngSHA. UI15manual12PASS,
1PARTIAL14 và2FAIL10/15 do upstreamGemini503; cleanupverified/residue0.
Current branch `codex/ai-tdee-range-followup-20261004` từ clean8cca5a8.
Mở rộng scope đúng AC034: root owns `tdeeIntake.js`, existing unit và HTTP intake
tests. Shared local parser nhận range gắn với tập, giữ enum/form như trước; response
text nhắc đúng hai endpoint user đã nói để khoảng60–90 không mất trên UI/history.
Không thêm schema, calculation field, externalization hoặc FE/API request change.
RED→GREEN tại buildTdeeIntakeResponse và POSTai/chat; negative cooking/reversed
range phải không được nhắc. Reuse FE/build evidence vì không thay FE; server focused,
AIeval/security/governance và trustedCI cho snapshot mới. Promotion SHA mới,
refreshKB/recovery rồi labelled fullUI15round2; không ghép điểm hai vòng.
Không retry trong một live turn, không đổi model/deadline/rubric/grader. Nếu503
lặp, ghi upstream blocker theo evidence; không vá bằng nguồn từ model prior.

Plan lưu trước implementation. Catalog receipt đã PASS riêng trên PR191;
baseline UI15 và recovery ở report098. Local QA/review đã PASS ở
[report099](../reports/099-ai-source-provenance-staging-followup-2026-10-04.md):
936 client, 3390 server, 73 AI eval, 14 targeted E2E, release build, lint và
security/governance gates. Full E2E đã PASS129 trên CI PR192; deployment/live
round1 chưa đạt target, follow-up TDEE và round kế tiếp pending như mô tả ở trên.
