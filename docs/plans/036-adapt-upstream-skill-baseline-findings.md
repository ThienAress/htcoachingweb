# Plan 036: Thích nghi các finding từ baseline Upstream Skill Radar

> **Hướng dẫn thực thi**: Follow từng step theo thứ tự. Mỗi upstream pattern chỉ là input tham khảo; viết lại theo
> stack, vocabulary và approval boundary của HTCOACHINGWEB. Không copy nguyên skill, không cài upstream package,
> không sửa production runtime chỉ để làm instruction artifact khớp lý thuyết.
>
> **Drift check**: Trước khi implement, đọc lại `docs/audits/2026-08-skill-radar.md`, snapshot hiện tại, các local
> targets trong step và Git status. Nếu upstream hash hoặc local target đã đổi, chạy `$skill-radar`/`$goad` lại cho
> đúng target trước khi patch.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: 030, 035
- **Category**: dx / security / tests
- **Planned at**: 2026-08-08
- **State**: IMPLEMENTED / LOCAL VERIFIED — PRERENDER ENV BLOCKED

## Why This Matters

Plan 035 đã tạo scanner, snapshot và Admin Radar nhưng lần baseline đầu tiên cho thấy hai loại drift phải được tách
rõ: upstream đổi so với hash trước và local workflow còn thiếu gì so với upstream hiện tại. Nếu chỉ nhìn `0 drift`,
maintainer có thể bỏ qua pattern tốt ngay trong lần review đầu. Plan này sửa semantics đó và thích nghi 13 finding
có giá trị mà không phá canonical rules, không thêm runtime dependency và không tự trao quyền cho upstream.

## Current State

- `.agents/scripts/skill-radar.mjs` — fetch repo/commit/raw source; mọi fetch exception hiện bị map thành
  `drift: unreachable`, và error branch không giữ `upstreamCommit`/`repositoryArchived` trước đó.
- `.agents/skills/skill-radar/SKILL.md` — mô tả drift review nhưng chưa nói rõ baseline content comparison bắt buộc
  trước khi đặt `lastReviewedAt`/decision.
- `.agents/skills/goad/SKILL.md` — có draft → approval → apply nhưng chưa có old/new scenario eval để chứng minh skill tốt hơn.
- `.agents/scripts/validate-agent-system.mjs` — kiểm tra metadata/link/catalog, chưa validate eval corpus.
- `.agents/skills/audit*`, `code-review`, `tdd-guide`, `plan-template` — đã có workflow project-native mạnh nhưng còn
  thiếu depth/deletion test, smell baseline, tautological-test guard và plan self-review.
- `.agents/skills/ui-quality/` và `.agents/skills/ui-check/` — có Brand/Product, anti-slop, WCAG, copy và responsive;
  thiếu subject/page-job/signature, curated interaction/performance checklist và React SPA composition guidance.
- `.agents/skills/ai-chat-system/`, `ai-check`, `new-tool` — có auth, quota, context/tool contract; chưa có threat matrix
  LLM01–LLM10 map tới code/test thật.
- `.agents/skills/seo-check/SKILL.md` — chủ yếu static grep; chưa tách rendered/live evidence nên có nguy cơ false finding
  với JSON-LD inject bằng JavaScript và chưa cover redirects, soft 404, CWV, E-E-A-T/cannibalization.
- Baseline audit canonical: `docs/audits/2026-08-skill-radar.md` — 13 `adapt`, 7 `defer`.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Radar tests | `npm run test:agents:radar` | exit 0, gồm transient/rate-limit cases mới |
| Agent validator | `npm run agents:validate` | exit 0, không warning |
| Skill eval contract | `node --test .agents/scripts/skill-eval.test.mjs` | exit 0, corpus/score fixtures pass |
| API focused | `npm run test:unit:server -- --run src/routes/__tests__/skillRadar.routes.integration.test.js` | exit 0 |
| Client presentation | `npm run test:unit:client -- --run src/pages/admin/skill-radar/__tests__/skillRadarPresentation.test.js` | exit 0 |
| AI focused | `npm run test:unit:server -- --run src/services/ai` | exit 0 cho targeted suite được chọn |
| Secret scan | `npm run security:secrets` | exit 0 |
| Boundary scan | `npm run security:data-boundaries` | exit 0 |
| Diff hygiene | `git diff --check` | exit 0 |

## Scope

**In scope**:

- Radar scanner/contract/tests, Admin read-model/presentation và spec liên quan tới drift semantics.
- `$skill-radar`, `$goad`, agent validator và một eval corpus/script local không gọi model mặc định.
- `$audit`, `$audit-playbook`, `$code-review`, `$tdd-guide`, `$plan-template` cùng reference trực tiếp nếu cần.
- `$ui-quality`, `$ui-check` và curated references cho UI/React SPA.
- `$ai-chat-system`, `$ai-check`, `$new-tool` và reference threat matrix; focused tests chỉ để map guard hiện có.
- `$seo-check` và reference tách static/rendered/live evidence.
- Audit/plan/index documentation.

**Out of scope**:

- Tự sửa `AGENTS.md` hoặc bất kỳ file nào trong `.agents/rules/`; security/SEO rule change cần approval riêng.
- Cài upstream skill, Sentry, Vercel AI SDK, MCP SDK hoặc UI hook/detector bên ngoài.
- Sửa auth/CSRF/JWT, AI production behavior, schema/database hoặc public UI trong plan instruction-only này.
- Gọi model trả phí trong CI; thu thập prompt/output thật; ghi raw upstream content vào snapshot.
- Commit, push, deploy, GitHub secret creation hoặc chạy migration/staging operation.

## Steps

### Step 1: Tách rate-limit khỏi repository unreachable và khóa baseline semantics

Sửa `.agents/scripts/skill-radar.mjs` để phân loại `403/429` hoặc GitHub rate-limit response thành trạng thái transient
riêng, giữ last-known-good `contentHash`, `upstreamCommit`, `repositoryArchived` và audit/decision metadata. Mở rộng
`skill-radar-contract.mjs`, server read model và client presentation cho drift mới (đề xuất `rate_limited`) mà không
coi đó là source archived. Trong `$skill-radar`, ghi rõ entry mới luôn cần baseline content comparison; hash `clean`
chỉ được dùng cho review sau khi đã có `lastReviewedAt` và report decision.

**Behavior**: GitHub API 403 nhưng raw source vẫn truy cập được không còn làm Admin báo repo chết; maintainer thấy
trạng thái cần retry và last-known-good provenance. First-time source không thể bị kết luận “không có gì học” chỉ vì
chưa có previous hash.

**Blast radius**: `.agents/scripts/skill-radar*.mjs`, `.agents/skills/skill-radar/**`, snapshot/spec,
`server/src/services/skillRadar.service.js`, client presentation và focused tests.

**Depends on**: none.

**Verify**: fixture 403/429 giữ metadata và map `rate_limited`; fixture 404/archive vẫn `unreachable`; Radar tests,
API focused và client presentation tests exit 0.

### Step 2: Thêm eval contract để đo skill thay vì chỉ validate cấu trúc

Tạo `.agents/evals/skills/README.md`, schema/corpus pilot và `.agents/scripts/skill-eval-contract.mjs` cùng unit tests.
Mỗi corpus có realistic prompt, expected workflow/output evidence, positive trigger và hard negative gần nghĩa. Pilot
trên `skill-radar`, `debugging`, `ui-quality` và `ai-chat-system`. Mở rộng `$goad` để trước khi apply phải ghi baseline
old/new và kết quả scenario; mặc định chỉ tạo/validate artifacts, không gọi external model. Validator kiểm tra duplicate
id, path, target skill, positive/negative coverage và không chứa absolute path/secret.

**Behavior**: Một thay đổi skill chỉ được gọi là cải thiện khi có scenario evidence và không làm trigger sai các
near-miss; CI vẫn deterministic và không phát sinh model cost.

**Blast radius**: `.agents/evals/skills/**`, `.agents/scripts/skill-eval-*`, validator, `$goad`, package scripts và tests.

**Depends on**: Step 1 để baseline review semantics ổn định.

**Verify**: test schema với valid corpus, duplicate, missing negative, absolute path và secret-like fixture; chạy
`node --test .agents/scripts/skill-eval.test.mjs` + `npm run agents:validate`.

### Step 3: Thích nghi architecture, review, TDD và plan guards

Đưa vocabulary `module/interface/depth/seam/locality`, deletion test và before/after evidence vào reference của
`$audit`/`$audit-playbook`; chỉ report candidate khi có friction thật và local target cụ thể. Thêm reference smell
baseline cho `$code-review`, ghi rõ heuristic không phải hard violation và project standard thắng. Thêm tautological
test guard + seam declaration vào `$tdd-guide`; khi seam rõ từ API/code thì tự chọn và ghi evidence, chỉ hỏi user khi
lựa chọn làm đổi contract. Thêm placeholder scan, spec-coverage self-review và reviewer-gate task sizing vào
`$plan-template`; không thêm auto-commit/worktree instruction.

**Behavior**: Audit/review tìm được architectural leverage thay vì chỉ file lớn; test không pass by construction;
plan không chứa placeholder và mỗi task có boundary có thể review độc lập.

**Blast radius**: chỉ các skill/references nêu trên và eval corpus tương ứng; không sửa application code.

**Depends on**: Step 2 để chạy before/after scenario eval.

**Verify**: agent validator pass; pilot evals chứng minh finding có evidence, tautological test bị flag và plan chứa
placeholder bị fail.

### Step 4: Bổ sung threat matrix cho HT Assistant mà không đổi runtime ngầm

Tạo reference `llm-threat-matrix.md` dưới `$ai-chat-system`, map LLM01–LLM10 tới entry point, existing guard, test và
proof gap trong project. Cập nhật `$ai-check` và `$new-tool` để bắt buộc kiểm tra: indirect prompt injection từ CMS,
sensitive disclosure/system-prompt leakage, output là untrusted, least privilege/confirmation, vector ownership,
provider/model supply chain, misinformation labeling và unbounded cost/iterations. Adapt JS security categories cần
thiết vào `$audit-playbook`; không sửa security rule canonical trong plan này.

Nếu mapping phát hiện runtime guard thực sự thiếu, ghi finding + separate implementation plan; không tiện tay patch AI
runtime trong instruction update.

**Behavior**: Mọi AI change có threat/evidence checklist bám code thật; instruction không tuyên bố guard tồn tại khi
chưa có test hoặc file evidence.

**Blast radius**: ba AI skills, một reference mới, audit-playbook reference và focused eval/test mapping.

**Depends on**: Step 2.

**Verify**: `node .agents/scripts/validate-tools.mjs`; targeted tests cho page-context untrusted, tool schema/authorization
và quota; agent validator, secret scan, data-boundary scan pass.

### Step 5: Nâng UI workflow bằng curated, SPA-compatible guidance

Trong `$ui-quality`, thêm new-surface brief tối thiểu gồm audience, single page job, surface mode và một signature
element; chạy design-plan → self-critique → build, nhưng narrow refinement phải giữ identity hiện có. Trong `$ui-check`,
chuyển rule chi tiết sang reference để skill chính gọn và dùng `rg`/PowerShell-compatible discovery. Curate các check
thiếu: semantic action/navigation, `aria-live`, form name/autocomplete/inputmode, paste/unsaved changes, explicit image
dimensions/loading, `min-w-0`, explicit transition properties, `Intl.*`, URL state, safe area và long-list strategy.

Thêm React SPA reference cho parallel independent async, defer third-party, listener cleanup/passive option, derived
state, functional state update, no inline component và boolean-prop/explicit-variant guard. Ghi rõ loại Next.js/RSC,
SWR và Impeccable hook/PRODUCT/DESIGN hierarchy.

**Behavior**: UI mới có direction cụ thể thay vì generic anti-slop; UI audit bắt interaction/performance issues có thể
ảnh hưởng người dùng mà không áp sai framework rules.

**Blast radius**: `$ui-quality`, `$ui-check`, references và eval fixtures; không sửa client runtime trong step này.

**Depends on**: Step 2.

**Verify**: UI eval fixtures cover Brand/Product/Read, form accessibility, long content/mobile và component boolean
variants; agent validator pass. Nếu dùng browser cho qualitative eval, giới hạn một desktop+mobile batch và tối đa một
confirmation round.

### Step 6: Tách SEO static, rendered và live-provider evidence

Refactor `$seo-check` thành ba mode có output rõ:

1. `static`: App routes, SEO props, sitemap, prerender, robots/llms và internal links từ code.
2. `rendered`: browser kiểm tra final canonical/meta/JSON-LD, response/navigation, mobile overflow và image attributes.
3. `live`: redirects/soft 404, PageSpeed/CWV và GA4/GSC opportunity/cannibalization khi credential/data đã cấu hình.

Không báo thiếu schema chỉ từ `curl/web_fetch`; không báo live PASS khi GA4/GSC chưa cấu hình — ghi `SKIP/BLOCKED`
kèm lý do. Thêm E-E-A-T/author/source freshness cho blog/recipe nhưng giữ policy canonical trong SEO rule, không sửa rule
trong plan này.

**Behavior**: SEO report phân biệt bằng chứng từ source, DOM đã render và provider thật; giảm false positive và không
giả vờ có dữ liệu production.

**Blast radius**: `$seo-check`, references/evals và docs liên quan; không tạo public page hoặc đổi sitemap runtime.

**Depends on**: Step 2.

**Verify**: fixtures có JSON-LD client-rendered, wrong canonical, redirect/soft-404 và missing credential; validator pass;
manual rendered check dùng một public route đại diện.

### Step 7: Re-run baseline comparison và chốt decision history

Chạy evals của từng group, `$goad` review cho target đã đổi, Radar tests và agent/security gates. Cập nhật report tháng
08 với before/after evidence và chuyển từng `adapt` sang trạng thái đã áp dụng chỉ khi verification tương ứng pass.
Giữ 7 source `defer` trong watchlist; không hạ lifecycle chỉ vì kỳ này không dùng.

**Behavior**: Admin/report thể hiện rõ source nào chỉ được theo dõi, source nào đã thích nghi và bằng chứng local nào
chứng minh improvement.

**Blast radius**: snapshot, audit, Plan 036/index; không thay watchlist membership nếu chưa có approval mới.

**Depends on**: Steps 1–6.

**Verify**: Radar + eval + agent validator + security scans + diff hygiene đều exit 0; review report không chứa raw
upstream content, absolute local path hoặc secret.

## Test Plan

- Radar: 403/429 transient, 404, archived, timeout, stale metadata preservation, first baseline review_due.
- Eval contract: valid corpus, duplicate ids, missing trigger polarity, invalid target, absolute path, secret-like data.
- Workflow evals: architectural deletion test, review smell heuristic, tautological assertion, plan placeholder/spec gap.
- AI: indirect prompt injection, unauthorized tool call, additional properties, untrusted output boundary, cost/iteration cap.
- UI: semantic action/navigation, form metadata, long content, image dimensions, `Intl.*`, boolean-prop smell, Brand/Product mode.
- SEO: source-only limitation, rendered JSON-LD, canonical mismatch, redirect/soft-404, live provider unavailable.

## Done Criteria

- [x] GitHub API rate-limit không còn bị báo là repository unreachable và last-known-good provenance được giữ.
- [x] First-time upstream luôn có baseline content comparison trước khi decision được coi là reviewed.
- [x] Có deterministic eval contract và ít nhất bốn pilot skill corpora với positive/negative cases.
- [x] 13 `adapt` findings có before/after evidence hoặc ghi rõ finding nào bị reject sau forward-test.
- [x] 7 `defer` sources vẫn giữ provenance/lifecycle và lý do cụ thể.
- [x] Không có upstream content copy nguyên, external runtime dependency, model-cost CI hoặc raw prompt/output capture.
- [x] Không sửa `AGENTS.md`/`.agents/rules/` nếu chưa có approval riêng.
- [x] Agent validator, Radar/eval tests, focused AI tests, secret/data-boundary scans và diff hygiene pass.
- [x] Audit tháng 08 và `docs/plans/README.md` phản ánh đúng trạng thái thực tế.

## Implementation Evidence

- Radar correctness: `npm run test:agents:radar` pass `13/13`; client presentation pass `3/3`; API Radar pass `6/6`.
  GitHub API `403/429` được phân loại `rate_limited`, giữ last-known-good metadata và source chưa review vẫn là
  `review_due`.
- Skill eval: deterministic contract pass `6/6`; validator xác nhận `4` corpus với `16` positive/negative scenario.
- Workflow/AI/UI/SEO: thêm reference project-native cho architecture depth, design smells, JavaScript/LLM threats,
  React SPA, web interface checks và ba evidence mode SEO; không cài hoặc copy nguyên upstream artifact.
- Regression: client unit pass `66` file / `310` test; focused server pass `3` file / `18` test; client lint pass;
  AI tool validation pass `11` tool; agent validator pass `28` skill, `0` warning.
- Security/hygiene: secret scan pass; repository data-boundary pass `0` violation; `git diff --check` pass.
- Client compile: Vite build hoàn tất `2842` module. Full `postbuild` prerender local không thể kết luận PASS vì thiếu
  `VITE_API_URL` và network tới Google Fonts/GA4 bị chặn; không có assertion regression từ phạm vi Plan 036.

## STOP Conditions

- Cần sửa security/SEO canonical rule hoặc production AI/auth/runtime để hoàn thành một instruction finding.
- Eval muốn gọi model/API trả phí hoặc lưu prompt/output thật mà chưa có cost/privacy approval.
- Upstream license/provenance không đủ để paraphrase pattern an toàn.
- React/UI rule chỉ đúng cho Next.js/RSC nhưng không chứng minh được với React 19 + Vite SPA.
- Live SEO verification cần GA4/GSC credential chưa cấu hình.
- Cùng verification fail ba vòng sau các sửa có evidence.

## Maintenance Notes

- `drift` trả lời trạng thái upstream; `decision` trả lời hành động local. Không suy luận một trường từ trường kia.
- Popularity/audit badge là discovery signal, không phải acceptance gate.
- Mỗi lần sửa skill phải chạy eval corpus của chính skill và các near-miss cạnh tranh.
- Stable source ít commit vẫn có thể giữ `active`; lifecycle change cần relevance, usage, maintainer, license và security evidence.
- Khi MCP/Sentry/Vercel AI SDK thực sự vào stack, review lại source 17–19 thay vì lấy decision `defer` cũ làm vĩnh viễn.
