# Skill Radar Audit — 2026-08

## Kết luận

Đây là **baseline gap audit** đầu tiên, không chỉ là lần tạo hash ban đầu.

- Metadata scanner khóa tại `2026-08-08T12:26:53.850Z`: 19 nguồn được GitHub API kiểm tra đầy đủ; riêng
  `coreyhaines31/marketingskills/seo-audit` gặp `HTTP 403` từ GitHub API.
- Raw source của `seo-audit` vẫn trả `HTTP 200`, có SHA-256
  `3b03a2e07578e9964acac0b6907ae343a904c6547bfefe779ba326db5eedd1cb`, khớp snapshot trước. Đây là
  fetch/rate-limit failure, không phải bằng chứng repo archived hoặc nội dung đổi.
- So sánh nội dung 20 upstream với local targets cho kết quả: **13 `adapt`**, **7 `defer`**, **0 `adopt`**,
  **0 `reject`**.
- Không copy/cài upstream, không sửa rule canonical và không thêm candidate vào watchlist. Sau approval, 13 finding
  `adapt` đã được viết lại theo stack và boundary của project qua `docs/plans/036-adapt-upstream-skill-baseline-findings.md`.

`drift: clean` chỉ có nghĩa upstream chưa đổi so với hash đã lưu. Nó **không** có nghĩa local skill đã ngang bằng
upstream. Vì vậy Radar phải giữ hai câu hỏi riêng: “upstream có đổi không?” và “local còn gap gì so với upstream?”.

## Evidence

- Discovery: [skills.sh Trending](https://www.skills.sh/trending),
  [Hot](https://www.skills.sh/hot), [Official](https://www.skills.sh/official) và
  [Security Audits](https://www.skills.sh/audits), quan sát ngày 2026-08-08.
- Provenance/hash: `.agents/upstream-skills/watchlist.json` và `.agents/upstream-skills/snapshot.json`.
- Local evidence chính:
  - `.agents/skills/debugging/references/deep-investigation.md` đã có feedback loop, RED/GREEN, hypotheses và cleanup.
  - `.agents/skills/domain-modeling/SKILL.md` đã tách glossary/spec/ADR và có ADR gate ba điều kiện.
  - `.agents/skills/qa/SKILL.md` đã yêu cầu evidence mới, HEAD, dirty-tree fingerprint và exit code.
  - `.agents/skills/ui-quality/` đã có Brand/Product register, WCAG, anti-slop và copy cơ bản.
  - `.agents/skills/audit*/` đã có attacker path, proof gap, accepted/rejected finding và re-validation.
  - AI runtime đã có untrusted page-context tests, ownership/auth tool checks, quota và `aiLogger` không ghi raw conversation.

## Baseline comparison — 20 upstream

Score theo thứ tự `R/E/N/C/S/M` trong review policy. Điểm chỉ hỗ trợ quyết định; source có điểm cao vẫn có thể
`defer` khi local đã tương đương hoặc stack chưa dùng capability đó.

| # | Upstream / commit / hash | Score | Decision | Gap có giá trị và local target |
|---:|---|---:|---|---|
| 1 | [improve-codebase-architecture](https://www.skills.sh/mattpocock/skills/improve-codebase-architecture) `c0d69015e0cc` / `7b76f01b0eef` | `2/2/2/1/2/2 = 11` | **adapt** | Bổ sung vocabulary `depth/locality/seam`, deletion test và trước/sau cho `$audit`/`$impact-check`; không dùng HTML CDN hoặc ép subagent. |
| 2 | [diagnosing-bugs](https://www.skills.sh/mattpocock/skills/diagnosing-bugs) `bda79a3c3ca2` / `b9339b09ee39` | `2/2/0/2/2/1 = 9` | defer | `$debugging` đã có loop RED-capable, reduce, 3–5 hypotheses, tagged instrumentation, regression seam và post-mortem. Giữ theo dõi upstream. |
| 3 | [domain-modeling](https://www.skills.sh/mattpocock/skills/domain-modeling) `ee8bae40062c` / `152e2c97239a` | `2/2/0/2/2/2 = 10` | defer | Local đã có glossary-only `CONTEXT.md`, scenario, code cross-check và ADR gate tương đương; taxonomy ADR local khác upstream nhưng đúng project. |
| 4 | [code-review](https://www.skills.sh/mattpocock/skills/code-review) `c0d69015e0cc` / `9cf46653dd9c` | `2/2/1/2/2/2 = 11` | **adapt** | Local có 3 axis tốt hơn nhưng smell baseline còn quá ngắn. Thêm danh mục smell có nhãn heuristic, project rules luôn thắng và tooling-enforced style không lặp lại. |
| 5 | [tdd](https://www.skills.sh/mattpocock/skills/tdd) `8a475c438d90` / `5e6b9c16b547` | `2/2/1/1/2/2 = 10` | **adapt** | Thêm anti-pattern test tautological và bắt buộc ghi seam đã chọn; chỉ hỏi user khi seam thay đổi contract đáng kể, không biến mọi test thành approval gate. |
| 6 | [writing-plans](https://www.skills.sh/obra/superpowers/writing-plans) `1e14b2377e37` / `72190c88b2b5` | `2/2/1/1/2/2 = 10` | **adapt** | `$plan-template` đã self-contained/vertical nhưng thiếu placeholder scan, spec-coverage pass và task boundary theo reviewer gate. Không adopt auto-commit/worktree. |
| 7 | [verification-before-completion](https://www.skills.sh/obra/superpowers/verification-before-completion) `3be5aad3dd24` / `2befe7fc55bc` | `2/2/0/2/2/2 = 10` | defer | `$qa` + `$cleanup-delivery` đã mạnh hơn: fresh evidence, Git fingerprint, PASS/FAIL/SKIP, release-evidence expiry. |
| 8 | [skill-creator](https://www.skills.sh/anthropics/skills/skill-creator) `b0cbd3df1533` / `dcd4803e61e9` | `2/2/2/1/2/1 = 10` | **adapt** | Project có validator nhưng chưa có eval corpus/baseline để chứng minh skill mới tốt hơn, chưa test positive/negative trigger và chưa đo regression giữa hai phiên bản. |
| 9 | [frontend-design](https://www.skills.sh/anthropics/skills/frontend-design) `2235be7c60b5` / `1608ea77fbb6` | `2/2/2/1/2/2 = 11` | **adapt** | Thêm audience + single page job, signature element, design-plan hai lượt và self-critique; giữ emerald/cyan brand truth và không thay visual identity ngoài scope. |
| 10 | [web-design-guidelines](https://www.skills.sh/vercel-labs/agent-skills/web-design-guidelines) `ba46938889d4` / `f4647ca866a3` | `2/2/2/1/1/1 = 9` | **adapt** | `$ui-check` thiếu `aria-live`, semantic action/navigation, form metadata, paste/unsaved-change, explicit image dimensions, `Intl.*`, URL state và safe-area checks. Curate vào local reference; không fetch live trong product/runtime. |
| 11 | [vercel-react-best-practices](https://www.skills.sh/vercel-labs/agent-skills/vercel-react-best-practices) `805687f34e8c` / `71ed7794962f` | `2/2/2/1/2/1 = 10` | **adapt** | Chỉ lấy rule phù hợp React 19 + Vite SPA: parallel async, defer third-party, event listener hygiene, derived state, functional update, no inline component và long-list rendering. Loại Next/RSC/SWR-specific rules. |
| 12 | [vercel-composition-patterns](https://www.skills.sh/vercel-labs/agent-skills/vercel-composition-patterns) `a5343bd997c4` / `e38e0eaa6093` | `2/2/2/1/2/1 = 10` | **adapt** | Local chưa có guard chống boolean-prop proliferation, explicit variants và provider interface. Chỉ áp dụng khi component API thực sự phức tạp, không ép Context cho state cục bộ. |
| 13 | [impeccable](https://www.skills.sh/pbakaus/impeccable/impeccable) `9a949fb543d4` / `a1ea82ce80f4` | `2/2/2/1/2/1 = 10` | **adapt** | Học surface modes (`Persuade/Operate/Read/Experience`) và visual QA tối đa hai lượt. Không cài hook, không tạo PRODUCT/DESIGN hierarchy song song với canonical project. |
| 14 | [code-security](https://www.skills.sh/semgrep/skills/code-security) `327da93b1791` / `b461c67676ae` | `2/2/1/1/2/1 = 9` | **adapt** | Bổ sung routing theo JS/GitHub Actions cho SSRF, path traversal, prototype pollution, ReDoS và workflow injection. Mọi sửa `.agents/rules/security/` phải manual review. |
| 15 | [llm-security](https://www.skills.sh/semgrep/skills/llm-security) `327da93b1791` / `4a5ef953b5dc` | `2/2/2/2/2/1 = 11` | **adapt** | Đây là gap ưu tiên cao: tạo threat matrix LLM01–LLM10 map tới prompt/context/tool/output/vector/quota/logging và focused tests của HT Assistant. |
| 16 | [security-audit](https://www.skills.sh/cloudflare/security-audit-skill/security-audit) `c1239b903704` / `928503b4eb74` | `2/2/0/2/2/1 = 9` | defer | Local đã yêu cầu attacker-controlled path, concrete impact, proof gap, reject false positive, re-validation và coverage ledger. Structured JSON/multi-run hunting chưa đủ lợi ích hiện tại. |
| 17 | [ai-sdk](https://www.skills.sh/vercel/ai/ai-sdk) `d06b002e247d` / `864e110a36c0` | `1/2/1/0/2/1 = 7` | defer | Project dùng Gemini REST/provider adapter, không cài Vercel `ai`; chỉ giữ nguyên tắc kiểm tra version/source thật, không đưa API `ToolLoopAgent/useChat` vào local. |
| 18 | [mcp-builder](https://www.skills.sh/anthropics/skills/mcp-builder) `ef740771ac90` / `0f4592dcb53c` | `1/2/2/1/2/0 = 8` | defer | Tool annotation, pagination, structured output và eval hữu ích nhưng MCP runtime chưa được chốt; Plan 028D vẫn cần ops approval. Review lại khi bắt đầu MCP implementation. |
| 19 | [sentry-setup-ai-monitoring](https://www.skills.sh/getsentry/sentry-agent-skills/sentry-setup-ai-monitoring) `681f114f407f` / `c4c1e5d36d15` | `1/2/1/1/1/1 = 7` | defer | Chưa có Sentry dependency; `aiLogger` đã đo latency/tool calls. Không bật prompt/output capture vì chứa health/PII; telemetry vendor cần privacy/cost decision riêng. |
| 20 | [seo-audit](https://www.skills.sh/coreyhaines31/marketingskills/seo-audit) prior `30f9b9a729bb` / `3b03a2e07578` | `2/2/2/1/2/2 = 11` | **adapt** | `$seo-check` cần tách static code audit với rendered/live audit; thêm browser JSON-LD check, redirects/soft-404, CWV, image, E-E-A-T và cannibalization khi GA4/GSC có dữ liệu. |

## Findings cần triển khai

| Priority | Finding | Upstream inputs | Local targets | Verification đề xuất |
|---|---|---|---|---|
| P0 | Radar đang gộp GitHub API `403` vào `unreachable` và làm mất commit metadata trong error branch | Run thực tế 2026-08-08 | scanner contract/tests, Admin read model/UI | Fixture 403/rate-limit giữ previous metadata, không gắn repo unreachable |
| P0 | Thiếu skill eval/baseline/trigger regression | `skill-creator` | `$goad`, validator, eval fixtures/scripts | Positive/negative trigger corpus + old/new comparison có evidence |
| P0 | AI skills chưa có LLM threat matrix đầy đủ | `llm-security`, `code-security` | `$ai-chat-system`, `$ai-check`, `$new-tool`, security manual gate | Focused tests cho injection, output, agency, vector ownership và cost bounds |
| P1 | Architecture/review/TDD/plan còn thiếu một số guard chất lượng | Matt + obra skills | `$audit`, `$audit-playbook`, `$code-review`, `$tdd-guide`, `$plan-template` | Agent validator + scenario-based instruction evals |
| P1 | UI workflow chưa đủ subject-grounded và thiếu nhiều interaction/perf checks | Anthropic + Vercel + Impeccable | `$ui-quality`, `$ui-check` và references | UI fixture audit, client lint/build, bounded desktop/mobile visual pass |
| P1 | SEO audit chưa phân biệt static với rendered/live evidence | `seo-audit` | `$seo-check`, SEO rule manual gate | Static route checks + browser-rendered JSON-LD/canonical + explicit SKIP khi GA4/GSC thiếu |

## Kết quả áp dụng 13 finding

| Nhóm upstream | Before | After / evidence local |
|---|---|---|
| `improve-codebase-architecture` | Audit chưa có depth/locality/seam, deletion test và bằng chứng trước/sau. | `$audit`/`$audit-playbook` dùng `references/architecture-depth.md`; validator pass. |
| `code-review`, `tdd`, `writing-plans` | Smell baseline ngắn; chưa khóa tautological test, seam và plan self-review. | Thêm `design-smells.md`, seam declaration, tautological-test guard, task sizing, spec/placeholder/type consistency checks. |
| `skill-creator` | Validator chỉ kiểm tra cấu trúc, chưa có scenario regression. | Eval contract pass `6/6`; `4` corpus / `16` positive-negative scenario được validator kiểm tra. |
| `frontend-design`, `web-design-guidelines` | UI workflow thiếu page job/signature và nhiều interaction/accessibility checks. | `$ui-quality` có audience/surface/two-pass critique; `$ui-check` có semantic/form/aria-live/image/Intl/URL/safe-area/long-list reference. |
| `vercel-react-best-practices`, `vercel-composition-patterns` | Chưa có React SPA performance/composition baseline riêng. | Thêm reference chỉ dành cho React 19 + Vite; loại Next/RSC/SWR và chỉ dùng explicit variants/provider khi API thực sự phức tạp. |
| `impeccable` | Chưa phân loại surface và chưa giới hạn vòng visual QA. | Bổ sung `Persuade/Operate/Read/Experience`; desktop/mobile batch và tối đa một confirmation round. |
| `code-security`, `llm-security` | Chưa có JavaScript threat routing và LLM01–LLM10 map tới code/test thật. | Thêm SSRF/path traversal/prototype pollution/ReDoS/XSS/workflow injection routing và HT Assistant threat matrix; focused server pass `18/18`. |
| `seo-audit` | Static grep có thể tạo false finding cho JSON-LD client-rendered và live provider thiếu credential. | `$seo-check` tách static/rendered/live; GA4/GSC thiếu dữ liệu phải `SKIP/BLOCKED`, không được giả `PASS`. |

Radar correctness đi kèm đã pass `13/13`, client presentation `3/3`, API Radar `6/6`; client unit pass
`66` file / `310` test; lint, `11` AI tool contract, secret scan và data-boundary scan đều pass. Vite compile hoàn tất
`2842` module; full prerender local vẫn bị chặn bởi thiếu `VITE_API_URL` và network Google Fonts/GA4, không phải
regression assertion của 13 finding. Bảy source `defer` giữ nguyên provenance, lifecycle và lý do trong snapshot.

## Candidate triage từ skills.sh

| Candidate | Decision | Lý do |
|---|---|---|
| [find-skills](https://www.skills.sh/vercel-labs/skills/find-skills) | reject | Trùng `$skill-radar`; workflow cài skill trực tiếp xung đột approval boundary. |
| [handoff](https://www.skills.sh/mattpocock/skills/handoff) | reject | Project đã có `$handoff`; không thêm duplicate source. |
| [anti-ui-slop](https://www.skills.sh/site/uizze.com/anti-ui-slop) | defer | Chưa đủ GitHub provenance/license/audit và overlap `$ui-quality`. |
| [ui-radar](https://www.skills.sh/site/uizze.com/ui-radar) | defer | Phụ thuộc external catalog, chưa đủ provenance/security evidence. |
| [review-skill](https://www.skills.sh/mongodb/agent-skills/review-skill) | reject | Audit signal có cảnh báo và capability trùng skill authoring/review hiện có. |

## Follow-up

1. Giữ 7 source `defer` trong watchlist và chỉ đánh giá lại khi stack/relevance thay đổi; không xem `defer` là loại bỏ.
2. Khi local skill hoặc upstream hash thay đổi, chạy lại corpus liên quan và `$goad` trước khi cập nhật decision history.
3. Scheduled scan tiếp theo dự kiến 09:00 Việt Nam ngày 01/09/2026; nên cấu hình `GITHUB_TOKEN` read-only cho
   workflow để giảm rate-limit, nhưng không lưu token trong repo hoặc snapshot.

## Addendum — 2026-08-11: emilkowalski/skills

- Thêm `emil-design-eng`, `review-animations` và `improve-animations` vào watchlist active, MIT, review 30 ngày.
- Decision chung: **adapt**. Lấy frequency/purpose gate, strict review và prioritized planning; không cài/copy nguyên repo,
  không đổi GSAP/CSS sang Motion/Sonner/Base UI và không bulk rewrite toàn bộ `transition-all`.
- Local targets là `ui-quality`, `ui-check`, motion references và `plan-template`; ChatWidget là pilot đầu tiên.
- TencentDB Agent Memory được tách sang AI Technology Radar vì đó là runtime/architecture rộng hơn skill contract.
