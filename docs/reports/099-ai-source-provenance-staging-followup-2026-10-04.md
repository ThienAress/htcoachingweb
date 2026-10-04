# HT Assistant source provenance follow-up — 2026-10-04

## Kết quả trước promotion

Target: staging. Base: `ff7ff4408a1b8b1aae6e660f3586296019dd86d6`.
Branch: `codex/ai-verified-source-followup-20261004`.
Plan: [094B](../plans/094b-resolve-source-provenance-and-retest-staging.md).
Kết luận: GO FOR STAGING sau các gate local bên dưới. Live UI15 chưa chạy trên
bản sửa này; mục tiêu vẫn ≥14/15 PASS, PARTIAL không tính PASS.

## Thay đổi và ảnh hưởng

- `sourceProvenance.js` chỉ quan sát Location của exact Google grounding redirect;
  không fetch/DNS destination, không đọc body hoặc gửi credential/referrer. Metadata
  publisher do provider đưa vào bị loại trước enrichment. Tối đa ba requests song
  song, một request/source, không retry/cache, budget 750 ms trong deadline cũ và
  reserve 500 ms. Timeout enrichment giữ nguồn với fallback trung tính.
- `toolEngine.js` dùng cùng normalized sources cho card/meta. Contract additive
  `provenance.kind/publisherHost`; URI click giữ nguyên. Không đổi schema, auth,
  quota, model, provider timeout hoặc CSP.
- `citation.js` và `SourceAvatar.jsx` hiển thị publisher từ provenance hợp lệ hoặc
  hostname direct. Redirect legacy/unresolved hiện Globe + “Nguồn web”. Title không
  quyết định publisher; direct URI không bị provenance override.
- `searchKnowledge.tool.js` chỉ phát citation đầu tiên cho mỗi transport URI trong
  câu trả lời, vẫn giữ mọi segment có grounding support. Không gộp bài theo publisher.
- `knowledgeAnswerScope.js` giới hạn generic identity ở 2–3 câu nhận diện ổn định;
  không tự thêm tuổi/tallies/current club. Yêu cầu stats/current detail vẫn được giữ.
  Privacy preparation chạy trước; không hardcode một người cụ thể.

Nguồn chỉ xuất hiện theo policy cần bằng chứng đã có ở PR191. Enrichment chứng minh
Location được quan sát, không chứng minh chất lượng bài hoặc final landing page.

## QA và evidence

Commands chạy trong candidate checkout, Node 22.23.1. Logs riêng tại local directory
`staging-ai-resume-20261003`; không đưa private captures/secret vào Git.

| Gate | Kết quả cuối | Evidence |
|---|---|---|
| Release build `npm run build --prefix client` | PASS, exit 0; prerender 44/44, bundle/search-index PASS | `pr192-release-build-v3.log` |
| `npm run test:unit:client` | PASS, exit 0; 186 files / 936 tests | `pr192-client-full-v2.log` |
| `npm run test:unit:server` | PASS, exit 0; 298 files / 3390 tests, đủ 10 batches | `pr192-server-full.log` |
| AI eval | PASS, exit 0; 73/73 | `pr192-ai-eval.log` |
| Focused source/scope + resolver/engine + route integration | PASS: 80 + 40 + 15 tests | Focused execution receipts |
| Focused citation cuối | PASS, exit 0; 28 tests | `pr192-citation-final.log` |
| Targeted rendered AI E2E | PASS, exit 0; 14 tests, workers=1 | `pr192-ai-e2e-v2.log` |
| Client lint | PASS, exit 0; 0 errors, 1 existing React Hook Form warning | `pr192-lint-v2.log` |
| UI regression | PASS; 0 new blocking findings, baseline unchanged | `pr192-ui-gate.log` |
| Tool validator | PASS, exit 0; 11 tools / 0 warnings | `pr192-tools.log` |
| Secrets / data boundaries / dependency client+server | PASS, exit 0; no waived advisory | `pr192-secrets.log`, `pr192-boundaries.log`, `pr192-dependency-*.log` |
| Agent governance | PASS, exit 0 | `pr192-governance-v2.log` |
| Docs privacy | PASS, exit 0 | `pr192-privacy.log` |

E2E command: `npm run test:e2e -- e2e/ai-citations.spec.js e2e/ai-chat.spec.js --workers=1`.
Đây là targeted local E2E, không phải full suite hoặc live provider acceptance.
Không tạo machine evidence releaseEligible từ subset command không thuộc allowlist.
Traceability094B là machine manifest 726 dòng để map toàn bộ requirement/AC của
spec canonical theo closed schema; giữ một file theo contract validator, ngoại lệ
giới hạn 300 dòng chỉ dành cho artifact này. Các module/test mới đều dưới 300 dòng.
Build dùng API staging cho VITE/SITEMAP/PRERENDER, REQUIRE_DYNAMIC_ROUTES=true và
VITE_TODAY_PLATFORM_ENABLED=true. Generated sitemap metadata được phục hồi chỉ sau
cohort comparison PASS; không reset workspace gốc.

Giữ failure evidence: client run đầu 935 PASS/1 unrelated import timeout; riêng file
recheck 9/9 PASS và canonical full rerun 936/936. E2E run đầu 12 PASS/2 timeout khi
release build đồng thời làm Vite reload; rerun sequential 14/14, giữ nguyên assertions
và timeout. Build cuối sandbox EACCES được rerun với mạng; không tắt dynamic gate.
MongoDB teardown có SIGKILL warning ở batch 2 nhưng command đủ 10 batches và exit 0.

## Security coverage và independent review

Independent reviewer Astra/xhigh: PASS, không còn finding cần sửa; MED legacy
fallback đã fix và có regression. Workers implementation Terra/medium; root tích
hợp/review và chạy QA. Reviewer không cấp quyền release và không thay live acceptance.

| Surface / threat | Trace và evidence | Trạng thái |
|---|---|---|
| Outbound / privacy, LLM02 | sources → URL validation → fixed Google GET/manual redirect → Location host only; hostile URI/Location, no headers/body/follow tests | Covered |
| Output handling, LLM05 | provider metadata stripped → server provenance → normalized card/meta → SSE/tool-history ownership → citation/avatar; spoof/legacy/direct regressions | Covered |
| Misinformation, LLM09 | privacy query → static identity instruction → supported-segment gate → URI-dedup; unsupported/current-scope regressions | Covered for local scope; live relevance pending |
| Consumption, LLM10 | existing tool deadline → bounded resolver and reserve; timeout/abort/fail-neutral tests | Covered; no LLM retry/cap increase |
| Tool agency/auth, LLM06 | Existing AJV/auth/guest/confirmation before tool; resolver read-only, no new mutating tool | Unchanged, focused engine regression |
| KB/vector write, LLM04/08 | No KB write/query change in this patch | Not applicable to diff; final live read-only check pending |

Proof gaps: runtime DNS/TLS/egress remain trusted; no separate three-request concurrency
test, intermediate remaining-budget boundary test or engine-level enrichment-abort
test. No exploit confirmed from these gaps. Public probe observed Google302→PMC
in 490ms, one request, zero destination requests, bodyRead=false. Probe is diagnostic.
Codex Security wrapper dry-run preflight is recorded separately; it is not a
completed security scan and does not replace local security review. No paid/full scan.
Preflight cuối exit0, dryRun=true, authentication verified=false;
`pr192-security-preflight-v2.log`. Lần đầu sandbox EACCES giữ riêng.

## Deployment và live acceptance còn lại

Chưa deploy candidate tại thời điểm báo cáo pre-promotion. Sau PR/CI/merge cần xác
minh exact 40-char merge SHA ở Netlify READY, Render LIVE, served HTML/assets/API
origin và protected runtime metrics. Không test dưới deployment cũ.

Hai catalog updates đã apply riêng trên PR191 với receipt transaction/post-state;
không apply lại. Backup production logical 20261004 đã được kiểm custody và restore
downloaded-copy độc lập; trước UI fixture kiểm current manifest freshness/recovery.
PITR vẫn false, không tuyên bố continuous recovery.

Refresh KB read-only: 26 published / 2 hold. UI15 corpus giữ 14 câu gốc và một
replacement5, không gọi exact-original15. Frozen grader/rubric giữ nguyên. Kiểm
sources/click/avatar/publisher và relevance thủ công cho case10/15; synthetic admin
trên exact htcoaching_staging, terminal ownership, SHA/boot stability và cleanup
verified=true/residue0 bắt buộc. Không có production deployment hoặc production writes.
