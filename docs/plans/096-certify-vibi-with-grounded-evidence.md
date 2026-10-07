# Plan 096: Hoàn thiện evidence và chứng nhận Vibi trên staging

## Status

- Priority: P1; Complexity: COMPLEX; Risk: HIGH; Effort: L.
- Depends on: 095, deployed history repair PR204.
- Lifecycle: IN PROGRESS; Verification: NONE; Rollout: NOT STARTED.
- Owner: 01a11481-8519-7f43-a42e-d89e59b6f411; Updated at: 2026-10-07.
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
