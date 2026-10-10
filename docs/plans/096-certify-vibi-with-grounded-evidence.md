# Plan 096: Hoàn thiện evidence và chứng nhận Vibi trên staging

## Status

- Priority: P1; Complexity: COMPLEX; Risk: HIGH; Effort: L.
- Depends on: 095, deployed history repair PR204.
- Lifecycle: IN PROGRESS; Verification: STAGING (code slice); Rollout: LIVE (code slice).
- Owner: 01a1172c-d836-7250-8396-275f41a6f75d; Updated at: 2026-10-08.
- Spec: `docs/specs/vibi-evidence-and-certification.md`.

## Vì sao và baseline

Lượt paid trước đạt 12/15: catalog sai một variant, hai câu thiếu web grounding;
workout draft có nội dung nhưng xuống dòng mềm bị gom một paragraph. TALK01 đã
fix/deploy nhưng chưa paid retest. Không chạy lại investigation hay reuse evidence.

Checkout: `.local-data/vibi-staging-20261006`, HEAD `49b81d9` sạch trước sửa.
Deployed staging merge SHA `f52db97714ca1916a5d5bf7c711cd007c4602627`.
Giữ DeepSeek history repair và Vibi gateway guard. Không sửa root checkout dirty.

## Scope và impact

Root: `requestRouter.js`, module capability mới, `searchKnowledge.tool.js`, search
adapter mới, `ai.controller.js` integration nhỏ, `deepseek.provider.js`, provider
metrics, focused tests và release certification gate.

Presentation: `workoutDraft.js`, workout tests, `MealSuggestionCard.jsx` và tests.
Catalog: audit/patch preparation; targeted staging write chỉ với fresh preimages.
Docs/operations: plan, spec, traceability, QA và report; evidence local không commit.
Không auth/payment/wallet/schema/production, không refactor controller rộng.

## Bảy bước theo thứ tự đã duyệt

### Step 1: Capability/provenance

Thêm policy additive; giữ existing router và citation.
   Verify focused router/source tests, privacy và compatibility tests PASS.
### Step 2: Web grounding

Xác minh Vibi docs và credential inventory; chọn external search
   adapter có cấu hình thật; bounded query/results/timeout, citation hỗ trợ evidence.
   Verify mocked transport failure/privacy/source tests và live search case 10/15.
### Step 3: Exercise catalog

Audit variants có nguồn kỹ thuật; fresh staging snapshot,
   preview/preimage/receipt/rollback, chỉ patch entry sai. Verify diff và case 9 live.
### Step 4: Structured presentation

Section workout, bài riêng, meal card dễ đọc; giữ
   safety/allergy/macros/totals. Verify focused unit, UI regression gate, rendered review.
### Step 5: TALK01 paid

Sau local QA và staging deploy đúng SHA, tạo hội thoại mới có
   3–5 nhóm tool hoàn tất qua request riêng. Verify no duplicate/history rejection.
### Step 6: Exact-15 mới

Corpus `.local-data/plan095-release-20261006/ui15-questions.json`;
   run/evidence mới, canonical parents mới, cùng model/SHA/rubric. Verify 15/15 records.
### Step 7: Observability/release gate

Duration/TTFT/tokens/tool/retry/error metadata không
   PII; gate exact-15 + TALK01 + CI5 + health + SHA + safety. Report GO/NO-GO thật.

## Verification commands

- Focused server: `cd server; npx vitest run <changed test paths>` → exit 0.
- Focused client: `cd client; npx vitest run <changed test paths>` → exit 0.
- Full: `npm run test:unit`, `npm run test:ai-eval`, `npm run test:e2e` → exit 0.
- UI: `npm run ui:audit -- --baseline scripts/ui-audit/baseline.json --fail-on-new-high`.
- Build/lint: `npm run build --prefix client`, `npm run lint --prefix client`.
- Security: `npm run security:secrets`, `npm run security:data-boundaries`.
- Governance: `npm run agents:validate`.
- New CI evidence và exact staging SHA bắt buộc; không reuse CI của baseline.

## Stop conditions

- Wallet còn tối đa $3 hoặc không kiểm chứng được balance: ngừng paid requests.
- Search credential chưa có: chuẩn bị/test adapter, chờ cấu hình; không bịa evidence.
- Catalog preimage drift/target sai: không write, đọc lại và báo rõ.
- Deploy/SHA/CI không match: không chạy certification giả định bản mới đã live.
- User thay đổi scope hoặc provider: cập nhật plan và impact trước dependent work.

## Tiêu chí hoàn thành

- [ ] Bảy bước có evidence, không chỉ code/test mock.
- [ ] TALK01 paid PASS và exact-15 mới 15/15, hoặc report rõ blockers và NO-GO.
- [ ] QA/CI/profile/health/SHA bind đúng candidate, safety không blocker.
- [ ] Report chi tiết, cost/balance thật, side effects và rollback catalog.

## Execution log

- 2026-10-08 resume: user yêu cầu sửa `no_supported_source` và hoàn tất phần còn
  thiếu của bảy bước, không làm lại phần đã đạt. Report 106 đối chiếu sáu thread:
  PR207 code slice đã deploy, WHO/Ronaldo FAIL; catalog chưa apply; presentation
  chưa rendered acceptance; TALK01 chưa live; exact-15 vẫn chưa chứng nhận.
  Tiếp tục trên candidate checkout, giữ nguyên thay đổi generated có sẵn.
  Thứ tự: reproduce selector/synthesis RED → GREEN; chốt provenance additive;
  fresh catalog preview/nguồn exact; rendered workout/meal; rollout staging và
  focused live acceptance/TALK01 trong giới hạn ví $3; gate/report theo evidence.
  User sau đó duyệt chạy corpus canonical 15 câu mới đúng một lần để đóng tiêu chí
  chứng nhận ban đầu. Giữ 14 câu gốc và câu 5 replacement đã duyệt, không gọi là
  exact original-15; không retry/best-of. TALK01 và rendered acceptance vẫn cần mới.
  Không cấp GO exact-15 khi reuse evidence; ghi rõ certification scope thực tế.
  Hypotheses search: H1 strict retrieval/query không có snippet phù hợp;
  H2 selector bỏ nguồn hợp lệ; H3 quote/numeric validation loại synthesis;
  H4 identity scope loại mọi claim. Probe lần lượt ở transport → selector → answer.
  Verify: fixture adapter/webEvidence/provider tests; guards privacy/injection/URL;
  local QA cho code đổi; live WHO/Ronaldo phải có supported citation, không fallback.

- Resume QA: client 945 PASS; server complete inventory 319 files/3682 tests PASS,
  qua diagnostic batch và verified remaining inventory sau launcher bị kẹt.
  Focused owned SSE 25 PASS, gồm claim-bound KB provenance RED→GREEN sau review.
  Build 44/44 routes/bundle PASS; E2E 128 PASS + một teardown timeout, affected
  file rerun 6 PASS. Lint/security/dependency/tools/agents/UI gates PASS.
  Catalog apply tám records và postimage/114 untouched records reconcile PASS.
  Code mới chưa deploy; exact15/TALK01/rendered còn pending. User đã duyệt
  commit/push/PR/merge/deploy staging; không kết luận certification đạt.

- 2026-10-07: checkout sạch; redacted staging inventory không có search credential.
  Vibi profile xác minh `deepseek-v4.1-flash`; chưa gọi paid inference mới.
- User chọn Brave và duyệt cấu hình trước khi lấy key. Adapter dùng fixed Brave
  LLM Context endpoint, một search và một bounded DeepSeek synthesis; không Gemini.
- Focused capability/provider/telemetry: 5 files, 35 tests PASS. Release gate:
  4 Node contract tests PASS. Presentation worker: 39 server + 11 client focused
  tests PASS, UI regression gate PASS; visual review chưa chạy.
- 2026-10-08: user thu hẹp nghiệm thu live còn WHO/Ronaldo, giữ 12 PASS lịch sử;
  không chạy lại exact-15/TALK01 hoặc patch catalog trong rollout này.
  User yêu cầu đưa candidate lên staging rồi retest hai câu search.
  Independent review phát hiện email trong claim thành autolink không thuộc source;
  thêm regression qua ChatBubble và neutralize email trước citation.
  Release này chỉ chứng nhận phạm vi retest, không tuyên bố toàn plan đã hoàn tất.

- 2026-10-10 live acceptance trên staging `773e6c6` (3 lượt, cùng kết quả): cổng backup,
  9 flow không-AI và cleanup AI (residue 0) PASS; ba lane AI chưa chạy vì
  `GET /api/knowledge-base/search` trả 503 sau ~30 giây. Log Vibi (nhóm `model - china`)
  cho thấy prompt chọn KB ~6,2k token luôn có Token đầu 21–27 giây hoặc không có output
  (40 giây, 1 phút 11 giây), trong khi prompt ~7,1k–8,4k token nhanh 0,7–1,8 giây; RPM/TPM
  = 0. Kết luận: chậm ở upstream Vibi→DeepSeek, không phải code của repo. Admin Search Test
  giữ hợp đồng 503 fail-closed. Chat giảm cấp khi chọn KB quá ngân sách 12 giây thành
  KB miss (`kbRetrieval.coverage="unknown"`), các lỗi khác vẫn fail-closed. Plan 096 vẫn NO-GO
  cho tới khi lane AI pass trên SHA triển khai.
